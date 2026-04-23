use axum::{
    body::Body,
    extract::{Extension, State},
    http::Request,
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};

use crate::{crypto, db::{queries, OrderRecord}, middleware::auth::Claims, trading};
use super::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderResponse {
    pub id: i64,
    pub bot_id: i64,
    pub market_id: String,
    pub side: String,
    pub price: f64,
    pub size: f64,
    pub status: String,
    pub order_id: Option<String>,
    pub created_at: String,
}

impl From<OrderRecord> for OrderResponse {
    fn from(r: OrderRecord) -> Self {
        Self {
            id: r.id,
            bot_id: r.bot_id,
            market_id: r.market_id,
            side: r.side,
            price: r.price,
            size: r.size,
            status: r.status,
            order_id: r.order_id,
            created_at: r.created_at,
        }
    }
}

pub async fn list_orders(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    if user_id == 0 {
        return Json(ErrorResponse {
            error: "Unauthorized".to_string(),
        })
        .into_response();
    }

    match queries::get_orders_by_user(&db, user_id).await {
        Ok(orders) => Json(orders.into_iter().map(OrderResponse::from).collect::<Vec<_>>()).into_response(),
        Err(e) => {
            tracing::error!("Failed to list orders: {}", e);
            Json(ErrorResponse {
                error: "Failed to list orders".to_string(),
            })
            .into_response()
        }
    }
}

// ============ NEW: Place Order, Cancel, Get Positions ============

#[derive(Debug, Serialize, Deserialize)]
pub struct PlaceOrderRequest {
    pub token_id: String,
    pub price: f64,
    pub size: f64,
    pub side: String, // "BUY" or "SELL"
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OrderResult {
    pub success: bool,
    pub order_id: Option<String>,
    pub message: String,
    pub error_code: Option<String>,
}

/// Place an order on Polymarket (checks balance first)
pub async fn place_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<PlaceOrderRequest>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // Validate side
    let side = payload.side.to_uppercase();
    if side != "BUY" && side != "SELL" {
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "Side must be BUY or SELL".to_string(),
            error_code: Some("INVALID_SIDE".to_string()),
        })
        .into_response();
    }

    // Validate price and size
    if payload.price <= 0.0 || payload.price >= 1.0 {
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "Price must be between 0 and 1".to_string(),
            error_code: Some("INVALID_PRICE".to_string()),
        })
        .into_response();
    }

    if payload.size <= 0.0 {
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "Size must be positive".to_string(),
            error_code: Some("INVALID_SIZE".to_string()),
        })
        .into_response();
    }

    // Get stored credentials
    let settings = match queries::get_settings(&db, user_id).await {
        Ok(Some((_api_key, encrypted_blob))) if !encrypted_blob.is_empty() => {
            let password = "techno"; // TODO: get from auth session
            let encryption_key = format!("{}_pm_creds", password);

            match crypto::decrypt(&encrypted_blob, &encryption_key) {
                Ok(json_str) => json_str,
                Err(e) => {
                    return Json(OrderResult {
                        success: false,
                        order_id: None,
                        message: format!("Failed to decrypt credentials: {}", e),
                        error_code: Some("CREDENTIALS_ERROR".to_string()),
                    })
                    .into_response();
                }
            }
        }
        Ok(None) | Ok(Some(_)) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: "No Polymarket credentials stored. Please add credentials first.".to_string(),
                error_code: Some("NO_CREDENTIALS".to_string()),
            })
            .into_response();
        }
        Err(e) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Database error: {}", e),
                error_code: Some("DB_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Parse credentials
    #[derive(Deserialize)]
    struct StoredCreds {
        key: String,
        secret: String,
        passphrase: String,
        #[serde(default)]
        private_key: String,
    }

    let creds: StoredCreds = match serde_json::from_str(&settings) {
        Ok(c) => c,
        Err(e) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Failed to parse credentials: {}", e),
                error_code: Some("CREDENTIALS_PARSE_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Get private key - need it for real trading
    let private_key = if !creds.private_key.is_empty() {
        creds.private_key
    } else if !creds.key.is_empty() {
        // If only API key is stored, can't place real orders
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "Private key required for real trading. Please re-add credentials with private key.".to_string(),
            error_code: Some("PRIVATE_KEY_REQUIRED".to_string()),
        })
        .into_response();
    } else {
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "No valid credentials found".to_string(),
            error_code: Some("NO_CREDENTIALS".to_string()),
        })
        .into_response();
    };

    // Create Polymarket client with real private key
    let pm_client = match trading::PolymarketClient::new(&private_key) {
        Ok(c) => c,
        Err(e) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Failed to create client: {}", e),
                error_code: Some("CLIENT_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Check balance
    match pm_client.get_balance().await {
        Ok(balance) => {
            let order_value = payload.price * payload.size;

            tracing::info!(
                "Order check - Balance: {} USDC, Order value: {} USDC",
                balance, order_value
            );

            if balance < order_value {
                return Json(OrderResult {
                    success: false,
                    order_id: None,
                    message: format!(
                        "INSUFFICIENT_BALANCE: Have {} USDC, need {} USDC for this order",
                        balance, order_value
                    ),
                    error_code: Some("INSUFFICIENT_BALANCE".to_string()),
                })
                .into_response();
            }

            // Balance sufficient - place real order on Polymarket
            let order_request = trading::polymarket::OrderRequest {
                token_id: payload.token_id.clone(),
                price: payload.price,
                size: payload.size,
                side: side.clone(),
            };

            // Create and sign the order
            let signed_order = match pm_client.create_order(&order_request).await {
                Ok(order) => order,
                Err(e) => {
                    return Json(OrderResult {
                        success: false,
                        order_id: None,
                        message: format!("Failed to create order: {}", e),
                        error_code: Some("ORDER_CREATE_FAILED".to_string()),
                    })
                    .into_response();
                }
            };

            // Post the order to Polymarket
            match pm_client.post_order(&signed_order).await {
                Ok(response) => {
                    let order_id = response.order_id.unwrap_or_else(|| {
                        format!("pending_{}", chrono::Utc::now().timestamp_millis())
                    });

                    tracing::info!(
                        "Real order placed: {} {} @ {} (value: {}) - ID: {}",
                        side, payload.size, payload.price, order_value, order_id
                    );

                    Json(OrderResult {
                        success: true,
                        order_id: Some(order_id),
                        message: format!(
                            "Order placed successfully: {} {} @ {} = {} USDC",
                            side, payload.size, payload.price, order_value
                        ),
                        error_code: None,
                    })
                    .into_response()
                }
                Err(e) => {
                    tracing::error!("Failed to post order: {}", e);
                    Json(OrderResult {
                        success: false,
                        order_id: None,
                        message: format!("Failed to place order: {}", e),
                        error_code: Some("ORDER_POST_FAILED".to_string()),
                    })
                    .into_response()
                }
            }
        }
        Err(e) => {
            Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Failed to check balance: {}", e),
                error_code: Some("BALANCE_CHECK_FAILED".to_string()),
            })
            .into_response()
        }
    }
}

/// Get current positions from Polymarket
pub async fn get_live_positions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // Get credentials
    let settings = match queries::get_settings(&db, user_id).await {
        Ok(Some((_api_key, encrypted_blob))) if !encrypted_blob.is_empty() => {
            let password = "techno";
            let encryption_key = format!("{}_pm_creds", password);

            match crypto::decrypt(&encrypted_blob, &encryption_key) {
                Ok(json_str) => json_str,
                Err(e) => {
                    return Json(ErrorResponse {
                        error: format!("Failed to decrypt credentials: {}", e),
                    })
                    .into_response();
                }
            }
        }
        _ => {
            return Json(ErrorResponse {
                error: "No credentials".to_string(),
            })
            .into_response();
        }
    };

    let _creds: StoredCreds = match serde_json::from_str(&settings) {
        Ok(c) => c,
        Err(e) => {
            return Json(ErrorResponse {
                error: format!("Failed to parse credentials: {}", e),
            })
            .into_response();
        }
    };

    // Get balance from data-api
    let pm_client = match trading::PolymarketClient::new("REMOVED_ADDRESS") {
        Ok(c) => c,
        Err(e) => {
            return Json(ErrorResponse {
                error: format!("Failed to create client: {}", e),
            })
            .into_response();
        }
    };

    match pm_client.get_balance().await {
        Ok(balance) => {
            #[derive(Serialize)]
            struct PositionResponse {
                balance: f64,
                positions: Vec<serde_json::Value>,
            }

            Json(PositionResponse {
                balance,
                positions: vec![],
            })
            .into_response()
        }
        Err(e) => {
            Json(ErrorResponse {
                error: format!("Failed to get positions: {}", e),
            })
            .into_response()
        }
    }
}

#[derive(Deserialize)]
struct StoredCreds {
    key: String,
    secret: String,
    passphrase: String,
}

/// Cancel an order
#[derive(Debug, Serialize, Deserialize)]
pub struct CancelOrderRequest {
    pub order_id: String,
}

// ============ Quick Trade for UP/DOWN buttons ============

#[derive(Debug, Serialize, Deserialize)]
pub struct QuickTradeRequest {
    /// "UP" or "DOWN" - betting BTC will go above or below beat price
    pub side: String,
    /// Amount in USDC to bet
    pub amount: f64,
    /// Optional market ID - defaults to active BTC 5m market
    pub market_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuickTradeResponse {
    pub success: bool,
    pub message: String,
    pub order_id: Option<String>,
    pub btc_price: Option<f64>,
    pub beat_price: Option<f64>,
    pub side: String,
    pub amount: f64,
    pub error_code: Option<String>,
}

/// Quick trade endpoint for UP/DOWN betting on BTC market
/// UP = bet BTC price will be ABOVE beat_price at end of 5m window
/// DOWN = bet BTC price will be BELOW beat_price at end of 5m window
pub async fn quick_trade(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<QuickTradeRequest>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // Validate side
    let side = payload.side.to_uppercase();
    if side != "UP" && side != "DOWN" {
        return Json(QuickTradeResponse {
            success: false,
            message: "Side must be UP or DOWN".to_string(),
            order_id: None,
            btc_price: None,
            beat_price: None,
            side: side,
            amount: payload.amount,
            error_code: Some("INVALID_SIDE".to_string()),
        })
        .into_response();
    }

    // Validate amount
    if payload.amount <= 0.0 || payload.amount > 1000.0 {
        return Json(QuickTradeResponse {
            success: false,
            message: "Amount must be between 0 and 1000 USDC".to_string(),
            order_id: None,
            btc_price: None,
            beat_price: None,
            side: side,
            amount: payload.amount,
            error_code: Some("INVALID_AMOUNT".to_string()),
        })
        .into_response();
    }

    // Fetch current BTC price and active market
    let btc_price = match fetch_btc_price_quick().await {
        Some(p) => p,
        None => {
            return Json(QuickTradeResponse {
                success: false,
                message: "Failed to fetch BTC price from Binance".to_string(),
                order_id: None,
                btc_price: None,
                beat_price: None,
                side: side,
                amount: payload.amount,
                error_code: Some("PRICE_FETCH_FAILED".to_string()),
            })
            .into_response();
        }
    };

    // Fetch active BTC 5m market to get beat_price and token_ids
    let market_info = match fetch_active_btc_market_quick().await {
        Some(m) => m,
        None => {
            return Json(QuickTradeResponse {
                success: false,
                message: "Failed to fetch active BTC market from Polymarket".to_string(),
                order_id: None,
                btc_price: Some(btc_price),
                beat_price: None,
                side: side,
                amount: payload.amount,
                error_code: Some("MARKET_FETCH_FAILED".to_string()),
            })
            .into_response();
        }
    };

    // Extract beat price
    let beat_price = market_info
        .get("event_metadata")
        .and_then(|m| m.get("price_to_beat"))
        .and_then(|p| p.as_f64())
        .unwrap_or(btc_price);

    // Extract token_ids for YES (UP) and NO (DOWN) outcomes
    let markets = market_info
        .get("markets")
        .and_then(|m| m.as_array())
        .and_then(|arr| arr.first());

    let yes_token_id = markets
        .and_then(|m| m.get("clobTokenIds"))
        .and_then(|ids| ids.as_array())
        .and_then(|arr| arr.first())
        .and_then(|id| id.as_str());

    let no_token_id = markets
        .and_then(|m| m.get("clobTokenIds"))
        .and_then(|ids| ids.as_array())
        .and_then(|arr| arr.get(1))
        .and_then(|id| id.as_str());

    if yes_token_id.is_none() || no_token_id.is_none() {
        return Json(QuickTradeResponse {
            success: false,
            message: "Could not find token IDs in market data".to_string(),
            order_id: None,
            btc_price: Some(btc_price),
            beat_price: Some(beat_price),
            side: side,
            amount: payload.amount,
            error_code: Some("TOKEN_ID_MISSING".to_string()),
        })
        .into_response();
    }

    // Determine which token to buy based on UP/DOWN
    // UP = YES outcome = BTC will be ABOVE beat_price
    // DOWN = NO outcome = BTC will be BELOW beat_price
    let (token_id, outcome) = if side == "UP" {
        (yes_token_id.unwrap(), "YES")
    } else {
        (no_token_id.unwrap(), "NO")
    };

    // Calculate price based on current probability
    // The market price reflects probability of outcome
    let yes_price = markets
        .and_then(|m| m.get("outcomePrices"))
        .and_then(|p| p.as_str())
        .map(|s| s.split(',').next().unwrap_or("0.5"))
        .and_then(|p| p.parse::<f64>().ok())
        .unwrap_or(0.5);

    let trade_price = if side == "UP" {
        yes_price // Buy YES at current price
    } else {
        1.0 - yes_price // Buy NO (inverse of YES price)
    };

    tracing::info!(
        "Quick trade: {} {} outcome at {} (BTC: {}, Beat: {})",
        side, outcome, trade_price, btc_price, beat_price
    );

    // Get stored credentials
    let settings = match queries::get_settings(&db, user_id).await {
        Ok(Some((_api_key, encrypted_blob))) if !encrypted_blob.is_empty() => {
            let password = "techno"; // TODO: get from auth session
            let encryption_key = format!("{}_pm_creds", password);

            match crypto::decrypt(&encrypted_blob, &encryption_key) {
                Ok(json_str) => json_str,
                Err(e) => {
                    return Json(QuickTradeResponse {
                        success: false,
                        message: format!("Failed to decrypt credentials: {}", e),
                        order_id: None,
                        btc_price: Some(btc_price),
                        beat_price: Some(beat_price),
                        side: side,
                        amount: payload.amount,
                        error_code: Some("CREDENTIALS_ERROR".to_string()),
                    })
                    .into_response();
                }
            }
        }
        _ => {
            return Json(QuickTradeResponse {
                success: false,
                message: "No Polymarket credentials stored. Please add credentials in Settings.".to_string(),
                order_id: None,
                btc_price: Some(btc_price),
                beat_price: Some(beat_price),
                side: side,
                amount: payload.amount,
                error_code: Some("NO_CREDENTIALS".to_string()),
            })
            .into_response();
        }
    };

    // Parse credentials to get private key
    #[derive(Deserialize)]
    struct StoredCredsFull {
        #[serde(default)]
        private_key: String,
    }

    let creds: StoredCredsFull = match serde_json::from_str(&settings) {
        Ok(c) => c,
        Err(e) => {
            return Json(QuickTradeResponse {
                success: false,
                message: format!("Failed to parse credentials: {}", e),
                order_id: None,
                btc_price: Some(btc_price),
                beat_price: Some(beat_price),
                side: side,
                amount: payload.amount,
                error_code: Some("CREDENTIALS_PARSE_ERROR".to_string()),
            })
            .into_response();
        }
    };

    if creds.private_key.is_empty() {
        return Json(QuickTradeResponse {
            success: false,
            message: "Private key required for trading. Please re-add credentials with private key.".to_string(),
            order_id: None,
            btc_price: Some(btc_price),
            beat_price: Some(beat_price),
            side: side,
            amount: payload.amount,
            error_code: Some("PRIVATE_KEY_REQUIRED".to_string()),
        })
        .into_response();
    }

    // Create Polymarket client
    let pm_client = match trading::PolymarketClient::new(&creds.private_key) {
        Ok(c) => c,
        Err(e) => {
            return Json(QuickTradeResponse {
                success: false,
                message: format!("Failed to create trading client: {}", e),
                order_id: None,
                btc_price: Some(btc_price),
                beat_price: Some(beat_price),
                side: side,
                amount: payload.amount,
                error_code: Some("CLIENT_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Check balance before placing order
    match pm_client.get_balance().await {
        Ok(balance) => {
            if balance < payload.amount {
                return Json(QuickTradeResponse {
                    success: false,
                    message: format!("INSUFFICIENT_BALANCE: Have {} USDC, need {} USDC", balance, payload.amount),
                    order_id: None,
                    btc_price: Some(btc_price),
                    beat_price: Some(beat_price),
                    side: side,
                    amount: payload.amount,
                    error_code: Some("INSUFFICIENT_BALANCE".to_string()),
                })
                .into_response();
            }

            // Place the order
            let order_request = trading::polymarket::OrderRequest {
                token_id: token_id.to_string(),
                price: trade_price,
                size: payload.amount / trade_price, // Convert USDC amount to shares
                side: "BUY".to_string(),
            };

            match pm_client.create_order(&order_request).await {
                Ok(signed_order) => {
                    match pm_client.post_order(&signed_order).await {
                        Ok(response) => {
                            let order_id = response.order_id.unwrap_or_else(|| {
                                format!("quick_{}", chrono::Utc::now().timestamp_millis())
                            });

                            tracing::info!(
                                "Quick trade placed: {} {} @ {} = {} USDC - Order: {}",
                                side, outcome, trade_price, payload.amount, order_id
                            );

                            Json(QuickTradeResponse {
                                success: true,
                                message: format!(
                                    "Bet placed: {} outcome at {} ({} USDC)",
                                    outcome, trade_price, payload.amount
                                ),
                                order_id: Some(order_id),
                                btc_price: Some(btc_price),
                                beat_price: Some(beat_price),
                                side: side,
                                amount: payload.amount,
                                error_code: None,
                            })
                            .into_response()
                        }
                        Err(e) => {
                            Json(QuickTradeResponse {
                                success: false,
                                message: format!("Failed to place order: {}", e),
                                order_id: None,
                                btc_price: Some(btc_price),
                                beat_price: Some(beat_price),
                                side: side,
                                amount: payload.amount,
                                error_code: Some("ORDER_POST_FAILED".to_string()),
                            })
                            .into_response()
                        }
                    }
                }
                Err(e) => {
                    Json(QuickTradeResponse {
                        success: false,
                        message: format!("Failed to create order: {}", e),
                        order_id: None,
                        btc_price: Some(btc_price),
                        beat_price: Some(beat_price),
                        side: side,
                        amount: payload.amount,
                        error_code: Some("ORDER_CREATE_FAILED".to_string()),
                    })
                    .into_response()
                }
            }
        }
        Err(e) => {
            Json(QuickTradeResponse {
                success: false,
                message: format!("Failed to check balance: {}", e),
                order_id: None,
                btc_price: Some(btc_price),
                beat_price: Some(beat_price),
                side: side,
                amount: payload.amount,
                error_code: Some("BALANCE_CHECK_FAILED".to_string()),
            })
            .into_response()
        }
    }
}

/// Fetch BTC price from Binance (for quick trade)
async fn fetch_btc_price_quick() -> Option<f64> {
    let client = reqwest::Client::new();

    match client
        .get("https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            #[derive(Deserialize)]
            struct BinancePrice {
                price: String,
            }

            resp.json::<BinancePrice>().await.ok()?.price.parse::<f64>().ok()
        }
        _ => None,
    }
}

/// Fetch active BTC 5-minute market from Polymarket Gamma API
async fn fetch_active_btc_market_quick() -> Option<serde_json::Value> {
    let client = reqwest::Client::new();

    match client
        .get("https://gamma-api.polymarket.com/events/slug/btc-5")
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => resp.json::<serde_json::Value>().await.ok(),
        _ => None,
    }
}

pub async fn cancel_order(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CancelOrderRequest>,
) -> Response {
    let user_id = claims.user_id;
    let db = state.db();

    // Get credentials for Polymarket API
    let settings = match queries::get_settings(&db, user_id).await {
        Ok(Some((_api_key, encrypted_blob))) if !encrypted_blob.is_empty() => {
            let password = "techno";
            let encryption_key = format!("{}_pm_creds", password);

            match crypto::decrypt(&encrypted_blob, &encryption_key) {
                Ok(json_str) => json_str,
                Err(e) => {
                    return Json(OrderResult {
                        success: false,
                        order_id: None,
                        message: format!("Failed to decrypt credentials: {}", e),
                        error_code: Some("CREDENTIALS_ERROR".to_string()),
                    })
                    .into_response();
                }
            }
        }
        Ok(None) | Ok(Some(_)) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: "No Polymarket credentials stored. Please add credentials first.".to_string(),
                error_code: Some("NO_CREDENTIALS".to_string()),
            })
            .into_response();
        }
        Err(e) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Database error: {}", e),
                error_code: Some("DB_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Parse credentials to get private key
    #[derive(Deserialize)]
    struct StoredCreds {
        #[serde(default)]
        key: String,
        #[serde(default)]
        secret: String,
        #[serde(default)]
        passphrase: String,
        #[serde(default)]
        private_key: String,
    }

    let creds: StoredCreds = match serde_json::from_str(&settings) {
        Ok(c) => c,
        Err(e) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Failed to parse credentials: {}", e),
                error_code: Some("CREDENTIALS_PARSE_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Get private key - try different field names
    let private_key = if !creds.private_key.is_empty() {
        creds.private_key
    } else if !creds.key.is_empty() {
        // If only API key is stored, we can't cancel orders
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "Private key required for order cancellation. Please re-add credentials with private key.".to_string(),
            error_code: Some("PRIVATE_KEY_REQUIRED".to_string()),
        })
        .into_response();
    } else {
        return Json(OrderResult {
            success: false,
            order_id: None,
            message: "No valid credentials found".to_string(),
            error_code: Some("NO_CREDENTIALS".to_string()),
        })
        .into_response();
    };

    // Create client and cancel order
    let pm_client = match trading::PolymarketClient::new(&private_key) {
        Ok(c) => c,
        Err(e) => {
            return Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Failed to create client: {}", e),
                error_code: Some("CLIENT_ERROR".to_string()),
            })
            .into_response();
        }
    };

    // Cancel the order on Polymarket
    match pm_client.cancel_order(&payload.order_id).await {
        Ok(_) => {
            tracing::info!("Order cancelled successfully: {}", payload.order_id);

            Json(OrderResult {
                success: true,
                order_id: Some(payload.order_id),
                message: "Order cancelled successfully".to_string(),
                error_code: None,
            })
            .into_response()
        }
        Err(e) => {
            tracing::error!("Failed to cancel order: {}", e);
            Json(OrderResult {
                success: false,
                order_id: None,
                message: format!("Failed to cancel order: {}", e),
                error_code: Some("CANCEL_FAILED".to_string()),
            })
            .into_response()
        }
    }
}
