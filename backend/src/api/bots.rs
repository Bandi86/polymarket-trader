use axum::{
    extract::{Extension, Path, State},
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};

use crate::db::{queries, BotRecord};
use crate::middleware::auth::Claims;
use crate::trading::PolymarketClient;
use super::AppState;

// ==================== Response Types ====================

#[derive(Debug, Serialize, Deserialize)]
pub struct BotResponse {
    pub id: i64,
    pub name: String,
    pub market_id: String,
    pub strategy_type: String,
    pub params: String,
    pub status: String,
    pub created_at: String,
    // Trading configuration (matching demo project)
    pub bet_size: f64,
    pub use_kelly: bool,
    pub kelly_fraction: f64,
    pub max_bet: f64,
    pub interval: i64,
    pub stop_loss: f64,
    pub take_profit: f64,
    // Stats
    pub total_trades: i64,
    pub winning_trades: i64,
    pub losing_trades: i64,
    pub win_rate: f64,
    // Trading mode: "paper" (simulated) or "live" (real orders)
    pub trading_mode: String,
}

impl From<BotRecord> for BotResponse {
    fn from(r: BotRecord) -> Self {
        Self {
            id: r.id,
            name: r.name,
            market_id: r.market_id,
            strategy_type: r.strategy_type,
            params: r.params,
            status: r.status,
            created_at: r.created_at,
            bet_size: r.bet_size,
            use_kelly: r.use_kelly != 0,
            kelly_fraction: r.kelly_fraction,
            max_bet: r.max_bet,
            interval: r.interval,
            stop_loss: r.stop_loss,
            take_profit: r.take_profit,
            total_trades: r.total_trades,
            winning_trades: r.winning_trades,
            losing_trades: r.losing_trades,
            win_rate: r.win_rate,
            trading_mode: r.trading_mode,
        }
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBotRequest {
    pub name: String,
    pub market_id: String,
    pub strategy_type: Option<String>,
    pub params: Option<String>,
    // Trading configuration (optional, defaults match demo project)
    #[serde(default = "default_bet_size")]
    pub bet_size: f64,
    #[serde(default = "default_use_kelly")]
    pub use_kelly: bool,
    #[serde(default = "default_kelly_fraction")]
    pub kelly_fraction: f64,
    #[serde(default = "default_max_bet")]
    pub max_bet: f64,
    #[serde(default = "default_interval")]
    pub interval: i64,
    #[serde(default = "default_stop_loss")]
    pub stop_loss: f64,
    #[serde(default = "default_take_profit")]
    pub take_profit: f64,
    // Trading mode: "paper" (default) or "live"
    #[serde(default = "default_trading_mode")]
    pub trading_mode: String,
}

fn default_bet_size() -> f64 { 1.0 }
fn default_use_kelly() -> bool { true }
fn default_kelly_fraction() -> f64 { 0.25 }
fn default_max_bet() -> f64 { 0.25 }
fn default_interval() -> i64 { 60000 } // 60 seconds (1 minute)
fn default_stop_loss() -> f64 { 0.1 } // 10%
fn default_take_profit() -> f64 { 0.2 } // 20%
fn default_trading_mode() -> String { "paper".to_string() }

#[derive(Debug, Serialize, Deserialize)]
pub struct UpdateBotRequest {
    pub name: Option<String>,
    pub market_id: Option<String>,
    pub strategy_type: Option<String>,
    pub params: Option<String>,
    // Trading configuration
    pub bet_size: Option<f64>,
    pub use_kelly: Option<bool>,
    pub kelly_fraction: Option<f64>,
    pub max_bet: Option<f64>,
    pub interval: Option<i64>,
    pub stop_loss: Option<f64>,
    pub take_profit: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BotStatusResponse {
    pub success: bool,
    pub status: String,
}

#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub session_id: i64,
    pub bot_id: i64,
    pub status: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub start_balance: f64,
    pub end_balance: Option<f64>,
    pub total_trades: i64,
    pub winning_trades: i64,
    pub losing_trades: i64,
    pub total_pnl: f64,
    pub max_drawdown: f64,
}

#[derive(Debug, Serialize)]
pub struct PortfolioResponse {
    pub bot_id: i64,
    pub balance: f64,
    pub initial_balance: f64,
    pub open_positions: i64,
    pub total_trades: i64,
    pub winning_trades: i64,
    pub losing_trades: i64,
    pub total_pnl: f64,
    pub peak_balance: f64,
    pub win_rate: f64,
    pub roi_percent: f64,
    pub drawdown_percent: f64,
    pub avg_pnl_per_trade: f64,
    // Unrealized PnL from open positions (live trading only)
    pub unrealized_pnl: f64,
    pub total_position_value: f64,
}

impl PortfolioResponse {
    pub fn from_record(p: crate::db::BotPortfolioRecord) -> Self {
        Self::from_record_with_positions(p, 0.0, 0.0)
    }

    pub fn from_record_with_positions(
        p: crate::db::BotPortfolioRecord,
        unrealized_pnl: f64,
        total_position_value: f64,
    ) -> Self {
        let win_rate = if p.total_trades > 0 {
            p.winning_trades as f64 / p.total_trades as f64 * 100.0
        } else {
            0.0
        };

        let roi_percent = if p.initial_balance > 0.0 {
            (p.balance - p.initial_balance) / p.initial_balance * 100.0
        } else {
            0.0
        };

        let drawdown_percent = if p.peak_balance > 0.0 {
            (p.peak_balance - p.balance) / p.peak_balance * 100.0
        } else {
            0.0
        };

        let avg_pnl_per_trade = if p.total_trades > 0 {
            p.total_pnl / p.total_trades as f64
        } else {
            0.0
        };

        Self {
            bot_id: p.bot_id,
            balance: p.balance,
            initial_balance: p.initial_balance,
            open_positions: p.open_positions,
            total_trades: p.total_trades,
            winning_trades: p.winning_trades,
            losing_trades: p.losing_trades,
            total_pnl: p.total_pnl,
            peak_balance: p.peak_balance,
            win_rate,
            roi_percent,
            drawdown_percent,
            avg_pnl_per_trade,
            unrealized_pnl,
            total_position_value,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct TradeDecisionResponse {
    pub id: i64,
    pub bot_id: i64,
    pub session_id: i64,
    pub market_slug: String,
    pub outcome: String,
    pub signal_confidence: f64,
    pub btc_price: Option<f64>,
    pub yes_price: Option<f64>,
    pub no_price: Option<f64>,
    pub time_remaining: Option<i64>,
    pub decision_reason: String,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct AggregatePortfolioResponse {
    pub user_id: i64,
    pub total_bots: i64,
    pub running_bots: i64,
    pub total_balance: f64,
    pub total_pnl: f64,
    pub total_trades: i64,
    pub overall_win_rate: f64,
    pub bots: Vec<PortfolioResponse>,
}

// ==================== CRUD Endpoints ====================

pub async fn create_bot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateBotRequest>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    if payload.name.is_empty() {
        return Json(ErrorResponse {
            error: "Bot name is required".to_string(),
        })
        .into_response();
    }

    if payload.market_id.is_empty() {
        return Json(ErrorResponse {
            error: "Market ID is required".to_string(),
        })
        .into_response();
    }

    let strategy = payload.strategy_type.unwrap_or_else(|| "btc_5min".to_string());
    let params = payload.params.unwrap_or_else(|| "{}".to_string());

    match queries::create_bot_with_config(
        &db,
        user_id,
        &payload.name,
        &payload.market_id,
        &strategy,
        &params,
        payload.bet_size,
        payload.use_kelly,
        payload.kelly_fraction,
        payload.max_bet,
        payload.interval,
        payload.stop_loss,
        payload.take_profit,
        &payload.trading_mode,
    )
    .await
    {
        Ok(bot_id) => Json(serde_json::json!({
            "id": bot_id,
            "name": payload.name,
            "market_id": payload.market_id,
            "strategy_type": strategy,
            "params": params,
            "status": "stopped",
            "bet_size": payload.bet_size,
            "use_kelly": payload.use_kelly,
            "kelly_fraction": payload.kelly_fraction,
            "max_bet": payload.max_bet,
            "interval": payload.interval,
            "stop_loss": payload.stop_loss,
            "take_profit": payload.take_profit,
            "trading_mode": payload.trading_mode
        }))
        .into_response(),
        Err(e) => {
            tracing::error!("Failed to create bot: {}", e);
            Json(ErrorResponse {
                error: "Failed to create bot".to_string(),
            })
            .into_response()
        }
    }
}

pub async fn list_bots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::get_bots_by_user(&db, user_id).await {
        Ok(bots) => Json(bots.into_iter().map(BotResponse::from).collect::<Vec<_>>()).into_response(),
        Err(e) => {
            tracing::error!("Failed to list bots: {}", e);
            Json(ErrorResponse {
                error: "Failed to list bots".to_string(),
            })
            .into_response()
        }
    }
}

pub async fn get_bot(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::get_bot_by_id(&db, id, user_id).await {
        Ok(Some(bot)) => Json(BotResponse::from(bot)).into_response(),
        Ok(None) => Json(ErrorResponse {
            error: "Bot not found".to_string(),
        })
        .into_response(),
        Err(e) => {
            tracing::error!("Failed to get bot: {}", e);
            Json(ErrorResponse {
                error: "Failed to get bot".to_string(),
            })
            .into_response()
        }
    }
}

pub async fn update_bot(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateBotRequest>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // Update basic fields
    if let Err(e) = queries::update_bot(
        &db,
        id,
        user_id,
        payload.name.as_deref(),
        payload.market_id.as_deref(),
        payload.strategy_type.as_deref(),
        payload.params.as_deref(),
    )
    .await
    {
        tracing::error!("Failed to update bot: {}", e);
        return Json(ErrorResponse {
            error: "Failed to update bot".to_string(),
        })
        .into_response();
    }

    // Update trading config fields
    if let Err(e) = queries::update_bot_config(
        &db,
        id,
        user_id,
        payload.bet_size,
        payload.use_kelly,
        payload.kelly_fraction,
        payload.max_bet,
        payload.interval,
        payload.stop_loss,
        payload.take_profit,
    )
    .await
    {
        tracing::error!("Failed to update bot config: {}", e);
        return Json(ErrorResponse {
            error: "Failed to update bot config".to_string(),
        })
        .into_response();
    }

    Json(serde_json::json!({"success": true})).into_response()
}

pub async fn delete_bot(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::delete_bot(&db, id, user_id).await {
        Ok(_) => Json(serde_json::json!({"success": true})).into_response(),
        Err(e) => {
            tracing::error!("Failed to delete bot: {}", e);
            Json(ErrorResponse {
                error: "Failed to delete bot".to_string(),
            })
            .into_response()
        }
    }
}

pub async fn start_bot(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // Get bot configuration
    let bot = match queries::get_bot_by_id(&db, id, user_id).await {
        Ok(Some(b)) => b,
        Ok(None) => return Json(ErrorResponse {
            error: "Bot not found".to_string(),
        }).into_response(),
        Err(e) => {
            tracing::error!("Failed to get bot: {}", e);
            return Json(ErrorResponse {
                error: "Failed to get bot".to_string(),
            }).into_response();
        }
    };

    // Check if bot is already running
    if state.orchestrator.is_running(id).await {
        return Json(ErrorResponse {
            error: "Bot is already running".to_string(),
        }).into_response();
    }

    // Get portfolio balance and check if sufficient
    let portfolio = match queries::get_portfolio(&db, id, user_id).await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to get portfolio: {}", e);
            return Json(ErrorResponse {
                error: "Failed to get portfolio".to_string(),
            }).into_response();
        }
    };

    // Balance validation - cannot start with 0 balance
    if portfolio.balance <= 0.0 {
        return Json(ErrorResponse {
            error: "Insufficient balance - bot cannot be started with 0 balance".to_string(),
        }).into_response();
    }

    // MATIC balance check for live trading (warn but don't block)
    if bot.trading_mode == "live" {
        let cache = state.credential_cache.read().await;
        if let Some(creds) = cache.get(&user_id) {
            let wallet = creds.wallet_address.clone();
            drop(cache);
            match crate::trading::check_matic_balance(&wallet).await {
                Ok(matic) => tracing::info!("Bot {} MATIC balance check: {:.6}", id, matic),
                Err(e) => tracing::warn!("Bot {} MATIC balance check failed: {}", id, e),
            }
        } else {
            tracing::warn!("Bot {} in live mode but no credentials in cache", id);
        }
    }

    // Use orchestrator to start the bot with current portfolio balance
    let initial_balance = portfolio.balance;
    match state.orchestrator.start_bot(&bot, initial_balance).await {
        Ok(session_id) => {
            tracing::info!("Bot {} started with session {} (balance: {:.2})", id, session_id, initial_balance);

            // Use bot's configured interval (convert from ms to seconds)
            let interval_secs = (bot.interval / 1000).max(10) as u64; // Minimum 10 seconds

            // Spawn the orchestrator loop for this bot
            let orchestrator = state.orchestrator.clone();
            let cred_cache = state.credential_cache.clone();
            tokio::spawn(async move {
                crate::trading::orchestrator::start_orchestrator_loop(
                    orchestrator, id, user_id, interval_secs, Some(cred_cache)
                ).await;
            });

            Json(BotStatusResponse {
                success: true,
                status: "running".to_string(),
            }).into_response()
        }
        Err(e) => {
            tracing::error!("Failed to start bot: {}", e);
            Json(ErrorResponse {
                error: e,
            }).into_response()
        }
    }
}

pub async fn stop_bot(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let user_id = claims.user_id;

    // Use orchestrator to stop the bot
    match state.orchestrator.stop_bot(id, user_id).await {
        Ok(_) => Json(BotStatusResponse {
            success: true,
            status: "stopped".to_string(),
        }).into_response(),
        Err(e) => {
            tracing::error!("Failed to stop bot: {}", e);
            Json(ErrorResponse {
                error: e,
            }).into_response()
        }
    }
}

// ==================== Session Endpoints ====================

/// Get current session for a bot
pub async fn get_session(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // First verify bot belongs to user
    match queries::get_bot_by_id(&db, id, user_id).await {
        Ok(Some(_)) => {
            // Bot exists and belongs to user
            match queries::get_active_session(&db, id).await {
                Ok(Some(session)) => Json(SessionResponse {
                    session_id: session.id,
                    bot_id: session.bot_id,
                    status: session.status,
                    start_time: session.start_time,
                    end_time: session.end_time,
                    start_balance: session.start_balance,
                    end_balance: session.end_balance,
                    total_trades: session.total_trades,
                    winning_trades: session.winning_trades,
                    losing_trades: session.losing_trades,
                    total_pnl: session.total_pnl,
                    max_drawdown: session.max_drawdown,
                }).into_response(),
                Ok(None) => Json(ErrorResponse {
                    error: "No active session".to_string(),
                }).into_response(),
                Err(e) => {
                    tracing::error!("Failed to get session: {}", e);
                    Json(ErrorResponse {
                        error: "Failed to get session".to_string(),
                    }).into_response()
                }
            }
        },
        Ok(None) => Json(ErrorResponse {
            error: "Bot not found".to_string(),
        }).into_response(),
        Err(e) => {
            tracing::error!("Failed to verify bot: {}", e);
            Json(ErrorResponse {
                error: "Failed to get session".to_string(),
            }).into_response()
        }
    }
}

/// Fetch unrealized PnL from open positions via Polymarket data-api
/// Returns (unrealized_pnl, total_position_value)
async fn fetch_unrealized_pnl(state: &AppState, user_id: i64) -> (f64, f64) {
    let cache = state.credential_cache.read().await;
    let creds = cache.get(&user_id).cloned();
    drop(cache);

    let Some(creds) = creds else {
        return (0.0, 0.0); // No credentials = no live positions
    };

    let client = match PolymarketClient::new(&creds.private_key) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!("Failed to create client for position check: {}", e);
            return (0.0, 0.0);
        }
    };

    match client.get_positions().await {
        Ok(positions) => {
            let mut unrealized_pnl = 0.0;
            let mut total_value = 0.0;
            for pos in &positions {
                if let Some(value) = pos.current_value {
                    total_value += value;
                    if let Some(bought) = pos.total_bought {
                        unrealized_pnl += value - bought;
                    }
                }
            }
            (unrealized_pnl, total_value)
        }
        Err(e) => {
            tracing::warn!("Failed to fetch positions for user {}: {}", user_id, e);
            (0.0, 0.0)
        }
    }
}

/// Get bot portfolio state
pub async fn get_portfolio(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    let portfolio = match queries::get_portfolio(&db, id, user_id).await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!("Failed to get portfolio: {}", e);
            return Json(ErrorResponse {
                error: "Failed to get portfolio".to_string(),
            }).into_response();
        }
    };

    // Fetch unrealized PnL from open positions (live trading)
    let (unrealized_pnl, total_position_value) = fetch_unrealized_pnl(&state, user_id).await;

    Json(PortfolioResponse::from_record_with_positions(
        portfolio, unrealized_pnl, total_position_value,
    )).into_response()
}

/// Get historical sessions for a bot
pub async fn get_history(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::get_bot_sessions(&db, id, user_id).await {
        Ok(sessions) => {
            let response: Vec<SessionResponse> = sessions.into_iter().map(|s| SessionResponse {
                session_id: s.id,
                bot_id: s.bot_id,
                status: s.status,
                start_time: s.start_time,
                end_time: s.end_time,
                start_balance: s.start_balance,
                end_balance: s.end_balance,
                total_trades: s.total_trades,
                winning_trades: s.winning_trades,
                losing_trades: s.losing_trades,
                total_pnl: s.total_pnl,
                max_drawdown: s.max_drawdown,
            }).collect();
            Json(response).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to get history: {}", e);
            Json(ErrorResponse {
                error: "Failed to get history".to_string(),
            }).into_response()
        }
    }
}

/// Get trade decisions for a bot
pub async fn get_trades(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::get_trade_decisions(&db, id, user_id).await {
        Ok(decisions) => {
            let response: Vec<TradeDecisionResponse> = decisions.into_iter().map(|d| TradeDecisionResponse {
                id: d.id,
                bot_id: d.bot_id,
                session_id: d.session_id,
                market_slug: d.market_slug,
                outcome: d.outcome,
                signal_confidence: d.signal_confidence,
                btc_price: d.btc_price,
                yes_price: d.market_yes_price,
                no_price: d.market_no_price,
                time_remaining: d.time_remaining,
                decision_reason: d.decision_reason.unwrap_or_default(),
                created_at: d.created_at,
            }).collect();
            Json(response).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to get trades: {}", e);
            Json(ErrorResponse {
                error: "Failed to get trades".to_string(),
            }).into_response()
        }
    }
}

// ==================== Bulk Operations ====================

/// Start all bots for user
pub async fn run_all_bots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::get_bots_by_user(&db, user_id).await {
        Ok(bots) => {
            let total = bots.len();
            let mut started = 0;
            let mut skipped_zero_balance = 0;

            for bot in bots {
                // Check if already running
                if state.orchestrator.is_running(bot.id).await {
                    continue;
                }

                // Check portfolio balance
                if let Ok(portfolio) = queries::get_portfolio(&db, bot.id, user_id).await {
                    if portfolio.balance <= 0.0 {
                        tracing::warn!("Bot {} has 0 balance, skipping", bot.id);
                        skipped_zero_balance += 1;
                        continue;
                    }

                    // Start with current balance
                    if state.orchestrator.start_bot(&bot, portfolio.balance).await.is_ok() {
                        // Use bot's configured interval
                        let interval_secs = (bot.interval / 1000).max(10) as u64;

                        let orchestrator = state.orchestrator.clone();
                        let cred_cache = state.credential_cache.clone();
                        let bot_id = bot.id;
                        tokio::spawn(async move {
                            crate::trading::orchestrator::start_orchestrator_loop(
                                orchestrator, bot_id, user_id, interval_secs, Some(cred_cache)
                            ).await;
                        });
                        started += 1;
                    }
                }
            }

            Json(serde_json::json!({
                "success": true,
                "started": started,
                "total": total,
                "skipped_zero_balance": skipped_zero_balance
            })).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to run all bots: {}", e);
            Json(ErrorResponse {
                error: "Failed to run all bots".to_string(),
            }).into_response()
        }
    }
}

/// Stop all bots for user
pub async fn stop_all_bots(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let user_id = claims.user_id;

    let running = state.orchestrator.get_running_bots(user_id).await;
    let mut stopped = 0;

    for bot_id in running {
        if state.orchestrator.stop_bot(bot_id, user_id).await.is_ok() {
            stopped += 1;
        }
    }

    Json(serde_json::json!({
        "success": true,
        "stopped": stopped
    })).into_response()
}

/// Get aggregate portfolio for user
pub async fn get_aggregate_portfolio(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    // Fetch unrealized PnL from open positions (wallet-level, not per-bot)
    let (unrealized_pnl, total_position_value) = fetch_unrealized_pnl(&state, user_id).await;

    match queries::get_bots_by_user(&db, user_id).await {
        Ok(bots) => {
            let mut total_balance = 0.0;
            let mut total_initial = 0.0;
            let mut total_pnl = 0.0;
            let mut total_trades = 0;
            let mut total_wins = 0;
            let mut running_bots = 0;
            let mut bot_portfolios = Vec::new();

            for bot in &bots {
                if let Ok(portfolio) = queries::get_portfolio(&db, bot.id, user_id).await {
                    total_balance += portfolio.balance;
                    total_initial += portfolio.initial_balance;
                    total_pnl += portfolio.total_pnl;
                    total_trades += portfolio.total_trades;
                    total_wins += portfolio.winning_trades;

                    bot_portfolios.push(PortfolioResponse::from_record_with_positions(
                        portfolio, 0.0, 0.0, // Per-bot unrealized PnL not tracked for aggregates
                    ));
                }

                if state.orchestrator.is_running(bot.id).await {
                    running_bots += 1;
                }
            }

            let overall_win_rate = if total_trades > 0 {
                total_wins as f64 / total_trades as f64 * 100.0
            } else {
                0.0
            };

            let overall_roi = if total_initial > 0.0 {
                (total_balance - total_initial) / total_initial * 100.0
            } else {
                0.0
            };

            let avg_pnl_per_trade = if total_trades > 0 {
                total_pnl / total_trades as f64
            } else {
                0.0
            };

            Json(serde_json::json!({
                "user_id": user_id,
                "total_bots": bots.len(),
                "running_bots": running_bots,
                "total_balance": total_balance,
                "total_initial": total_initial,
                "total_pnl": total_pnl,
                "total_trades": total_trades,
                "overall_win_rate": overall_win_rate,
                "overall_roi_percent": overall_roi,
                "avg_pnl_per_trade": avg_pnl_per_trade,
                "unrealized_pnl": unrealized_pnl,
                "total_position_value": total_position_value,
                "bots": bot_portfolios
            })).into_response()
        },
        Err(e) => {
            tracing::error!("Failed to get aggregate portfolio: {}", e);
            Json(ErrorResponse {
                error: "Failed to get portfolio".to_string(),
            }).into_response()
        }
    }
}
