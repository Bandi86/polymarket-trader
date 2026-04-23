//! Server-Sent Events for real-time bot and market updates

use axum::{
    extract::State,
    response::{
        sse::{Event, KeepAlive, Sse},
    },
};
use futures_util::stream::Stream;
use std::convert::Infallible;
use std::sync::Arc;
use tokio::sync::RwLock;

use super::AppState;

const GAMMA_API: &str = "https://gamma-api.polymarket.com";
const CLOB_API: &str = "https://clob.polymarket.com";
const TIMEFRAME_DURATION_SECS: i64 = 300; // 5 minutes

/// Fetch current BTC price from Binance
async fn fetch_btc_price() -> Option<f64> {
    let client = reqwest::Client::new();

    let result = client
        .get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
        .timeout(std::time::Duration::from_secs(3))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            #[derive(serde::Deserialize)]
            struct BinancePrice {
                price: String,
            }

            match resp.json::<BinancePrice>().await {
                Ok(data) => data.price.parse::<f64>().ok(),
                Err(_) => None,
            }
        }
        _ => None,
    }
}

/// Fetch market by slug using timestamp-based discovery
async fn fetch_market_by_slug(slug: &str) -> Option<(serde_json::Value, String)> {
    let client = reqwest::Client::new();

    let result = client
        .get(format!("{}/events/slug/{}", GAMMA_API, slug))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(event) => {
                    // Check if event is active
                    if event.get("active").and_then(|a| a.as_bool()) != Some(true) {
                        return None;
                    }
                    if event.get("closed").and_then(|c| c.as_bool()) == Some(true) {
                        return None;
                    }

                    // Get first market
                    let markets = event.get("markets").and_then(|m| m.as_array());
                    if markets.is_none() || markets.unwrap().is_empty() {
                        return None;
                    }

                    let market = markets.unwrap().first()?.clone();

                    // Check if market is active
                    if market.get("active").and_then(|a| a.as_bool()) != Some(true) {
                        return None;
                    }
                    if market.get("closed").and_then(|c| c.as_bool()) == Some(true) {
                        return None;
                    }

                    // Check if not expired
                    let end_date = market.get("endDate").and_then(|d| d.as_str())?;
                    let end_time = chrono::DateTime::parse_from_rfc3339(end_date)
                        .ok()
                        .map(|dt| dt.timestamp())?;

                    if end_time < chrono::Utc::now().timestamp() {
                        return None;
                    }

                    // Extract clobTokenIds for fast midpoint fetching
                    let clob_token_ids = market.get("clobTokenIds")
                        .and_then(|t| t.as_str())
                        .and_then(|s| {
                            let ids: Vec<String> = serde_json::from_str(s).ok()?;
                            if ids.len() >= 2 {
                                Some(ids[0].clone()) // First token is usually YES/UP
                            } else {
                                None
                            }
                        });

                    // Store token ID in market data
                    let mut market_data = market.clone();
                    if let Some(token_id) = clob_token_ids {
                        market_data["yes_token_id"] = serde_json::json!(token_id);
                    }

                    tracing::info!("Found active market via slug {}: {}", slug,
                        market.get("question").and_then(|q| q.as_str()).unwrap_or(""));

                    Some((market_data, slug.to_string()))
                }
                Err(_) => None,
            }
        }
        _ => None,
    }
}

/// Discover active BTC up/down markets using timestamp-based slugs
async fn discover_btc_market() -> Option<(serde_json::Value, String)> {
    let now = chrono::Utc::now().timestamp();
    let rounded_time = (now / TIMEFRAME_DURATION_SECS) * TIMEFRAME_DURATION_SECS;

    // Try multiple offsets to handle timing mismatches
    for offset in 0..4 {
        let try_time = rounded_time - (offset * TIMEFRAME_DURATION_SECS);
        let slug = format!("btc-updown-5m-{}", try_time);

        if let Some(market) = fetch_market_by_slug(&slug).await {
            return Some(market);
        }
    }

    // Try ETH as fallback
    for offset in 0..4 {
        let try_time = rounded_time - (offset * TIMEFRAME_DURATION_SECS);
        let slug = format!("eth-updown-5m-{}", try_time);

        if let Some(market) = fetch_market_by_slug(&slug).await {
            tracing::info!("Using ETH market as fallback");
            return Some(market);
        }
    }

    tracing::warn!("No active BTC/ETH up/down market found");
    None
}

/// Fetch fast midpoint price from CLOB API (faster than Gamma)
async fn fetch_clob_midpoint(token_id: &str) -> Option<f64> {
    let client = reqwest::Client::new();

    let result = client
        .get(format!("{}/midpoint?token_id={}", CLOB_API, token_id))
        .timeout(std::time::Duration::from_millis(500))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(data) => {
                    data.get("mid").and_then(|m| m.as_str())
                        .and_then(|s| s.parse::<f64>().ok())
                        .or_else(|| data.get("mid").and_then(|m| m.as_f64()))
                }
                Err(_) => None,
            }
        }
        _ => None,
    }
}

/// Fetch market prices from Gamma API (fallback)
async fn fetch_gamma_prices(market_id: &str) -> Option<(f64, f64)> {
    let client = reqwest::Client::new();

    let result = client
        .get(format!("{}/markets/{}", GAMMA_API, market_id))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await;

    match result {
        Ok(resp) if resp.status().is_success() => {
            match resp.json::<serde_json::Value>().await {
                Ok(market) => {
                    let prices_str = market.get("outcomePrices").and_then(|p| p.as_str())?;
                    let prices: Vec<&str> = prices_str.split(',').collect();

                    if prices.len() >= 2 {
                        let yes_str = prices[0].trim().trim_matches('"').trim_matches('[').trim_matches('"');
                        let no_str = prices[1].trim().trim_matches('"').trim_matches(']').trim_matches('"');

                        let yes = yes_str.parse::<f64>().ok()?;
                        let no = no_str.parse::<f64>().ok()?;

                        Some((yes, no))
                    } else {
                        None
                    }
                }
                Err(_) => None,
            }
        }
        _ => None,
    }
}

/// SSE stream for bot and market events
pub async fn bot_events_stream(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let state_clone = state.clone();

    // Shared state
    let last_btc_price = Arc::new(RwLock::new(0.0));
    let last_start_price = Arc::new(RwLock::new(0.0)); // BTC price at market start time
    let last_market = Arc::new(RwLock::new(None::<serde_json::Value>));
    let last_market_id = Arc::new(RwLock::new(String::new()));
    let last_yes_token = Arc::new(RwLock::new(String::new()));
    let last_event_start_time = Arc::new(RwLock::new(0i64)); // Market start timestamp

    tracing::info!("Starting SSE stream for real-time Polymarket updates");

    let stream = async_stream::stream! {
        // Initial connection message
        yield Ok(Event::default()
            .event("connected")
            .data(r#"{"type":"connected","message":"SSE connected"}"#));

        // Intervals
        let mut status_interval = tokio::time::interval(std::time::Duration::from_secs(5));
        let mut btc_interval = tokio::time::interval(std::time::Duration::from_secs(2));
        let mut price_interval = tokio::time::interval(std::time::Duration::from_millis(300)); // Fast!
        let mut discovery_interval = tokio::time::interval(std::time::Duration::from_secs(30));

        // Skip first ticks
        status_interval.tick().await;
        btc_interval.tick().await;
        price_interval.tick().await;
        discovery_interval.tick().await;

        // Initial market discovery
        if let Some((market, slug)) = discover_btc_market().await {
            let market_id = market.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
            let yes_token = market.get("yes_token_id").and_then(|t| t.as_str()).unwrap_or("").to_string();

            // Get eventStartTime - the start of the 5-minute window
            let event_start_time = market.get("eventStartTime")
                .and_then(|t| t.as_str())
                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                .map(|dt| dt.timestamp())
                .unwrap_or(0);

            let mut market_lock = last_market.write().await;
            *market_lock = Some(market.clone());
            let mut id_lock = last_market_id.write().await;
            *id_lock = market_id;
            let mut token_lock = last_yes_token.write().await;
            *token_lock = yes_token;
            let mut start_time_lock = last_event_start_time.write().await;
            *start_time_lock = event_start_time;

            tracing::info!("Initial market: {} (starts at {})",
                market.get("question").and_then(|q| q.as_str()).unwrap_or(""),
                event_start_time);
        }

        loop {
            tokio::select! {
                // Market discovery (every 30s)
                _ = discovery_interval.tick() => {
                    let current_market = last_market.read().await.clone();
                    let needs_new = if let Some(ref m) = current_market {
                        let end_date = m.get("endDate").and_then(|d| d.as_str());
                        end_date.map_or(true, |end| {
                            chrono::DateTime::parse_from_rfc3339(end)
                                .ok()
                                .map_or(true, |dt| dt.timestamp() < chrono::Utc::now().timestamp())
                        })
                    } else {
                        true
                    };

                    if needs_new {
                        tracing::info!("Discovering new market...");
                        if let Some((market, slug)) = discover_btc_market().await {
                            let market_id = market.get("id").and_then(|i| i.as_str()).unwrap_or("").to_string();
                            let yes_token = market.get("yes_token_id").and_then(|t| t.as_str()).unwrap_or("").to_string();

                            // Get eventStartTime - the start of the 5-minute window
                            let event_start_time = market.get("eventStartTime")
                                .and_then(|t| t.as_str())
                                .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                                .map(|dt| dt.timestamp())
                                .unwrap_or(0);

                            let mut market_lock = last_market.write().await;
                            *market_lock = Some(market.clone());
                            let mut id_lock = last_market_id.write().await;
                            *id_lock = market_id;
                            let mut token_lock = last_yes_token.write().await;
                            *token_lock = yes_token;
                            let mut start_time_lock = last_event_start_time.write().await;
                            *start_time_lock = event_start_time;
                            // Reset start price when new market is discovered
                            let mut start_price_lock = last_start_price.write().await;
                            *start_price_lock = 0.0;

                            tracing::info!("New market: {} (starts at {})",
                                market.get("question").and_then(|q| q.as_str()).unwrap_or(""),
                                event_start_time);
                        }
                    }
                }

                // Fast price update (every 300ms) - use CLOB midpoint for fastest prices
                _ = price_interval.tick() => {
                    let market_id = last_market_id.read().await.clone();
                    let yes_token = last_yes_token.read().await.clone();
                    let market = last_market.read().await.clone();
                    let event_start_time = *last_event_start_time.read().await;
                    let current_time = chrono::Utc::now().timestamp();

                    if !market_id.is_empty() {
                        // Try CLOB API first (fastest)
                        let (yes, no) = if !yes_token.is_empty() {
                            if let Some(yes_price) = fetch_clob_midpoint(&yes_token).await {
                                (yes_price, 1.0 - yes_price)
                            } else {
                                // Fallback to Gamma
                                fetch_gamma_prices(&market_id).await.unwrap_or((0.5, 0.5))
                            }
                        } else {
                            fetch_gamma_prices(&market_id).await.unwrap_or((0.5, 0.5))
                        };

                        let btc_price = *last_btc_price.read().await;
                        let current_start_price = *last_start_price.read().await;

                        // Capture start price when market begins (only once per market)
                        // If we connect mid-market, use current price as baseline
                        if btc_price > 0.0 && event_start_time > 0 && current_start_price == 0.0 {
                            let mut start_price_lock = last_start_price.write().await;
                            *start_price_lock = btc_price;
                            tracing::info!("Captured start price: {} for market starting at {}", btc_price, event_start_time);
                        }

                        let start_price = *last_start_price.read().await;

                        // Calculate time remaining until market end
                        let time_remaining = market.as_ref()
                            .and_then(|m| m.get("endDate").and_then(|d| d.as_str()))
                            .and_then(|end| chrono::DateTime::parse_from_rfc3339(end).ok())
                            .map_or(300, |dt| dt.timestamp() - current_time)
                            .max(0);

                        // Extract volume and question
                        let volume = market.as_ref()
                            .and_then(|m| m.get("volumeNum").and_then(|v| v.as_f64())
                                .or_else(|| m.get("liquidityNum").and_then(|v| v.as_f64())))
                            .unwrap_or(0.0);

                        let question = market.as_ref()
                            .and_then(|m| m.get("question").and_then(|q| q.as_str()))
                            .unwrap_or("BTC Up or Down?");

                        // Determine market sentiment based on YES price
                        let sentiment = if yes > 0.5 { "UP" } else { "DOWN" };

                        // Calculate price delta (current vs start)
                        let price_delta = if start_price > 0.0 && btc_price > 0.0 {
                            btc_price - start_price
                        } else {
                            0.0
                        };

                        let update = serde_json::json!({
                            "type": "market_price",
                            "btc_price": btc_price,
                            "start_price": start_price,
                            "price_to_beat": start_price,
                            "price_delta": price_delta,
                            "yes": yes,
                            "no": no,
                            "time_remaining": time_remaining,
                            "market_duration": 300,
                            "volume": volume,
                            "market_question": question,
                            "sentiment": sentiment,
                            "event_start_time": event_start_time,
                            "timestamp": chrono::Utc::now().to_rfc3339()
                        });

                        yield Ok(Event::default()
                            .event("market")
                            .data(update.to_string()));
                    }
                }

                // BTC price update (every 2s)
                _ = btc_interval.tick() => {
                    if let Some(btc_price) = fetch_btc_price().await {
                        if btc_price > 0.0 {
                            let mut price_lock = last_btc_price.write().await;
                            *price_lock = btc_price;
                        }
                    }
                }

                // Status update (every 5s)
                _ = status_interval.tick() => {
                    let running_bots = state_clone.orchestrator.get_running_bots(0).await.len();
                    let btc_price = *last_btc_price.read().await;

                    let status = serde_json::json!({
                        "type": "status",
                        "running_bots": running_bots,
                        "btc_price": btc_price,
                        "total_pnl": 0.0,
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    });

                    yield Ok(Event::default()
                        .event("status")
                        .data(status.to_string()));
                }
            }
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}