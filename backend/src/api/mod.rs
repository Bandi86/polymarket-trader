use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;
use tokio::sync::{RwLock, mpsc};

use crate::db::Db;
use crate::middleware::auth as auth_middleware;
use crate::trading::BinanceClient;
use crate::trading::orchestrator::{BotOrchestrator, BotEvent};

pub mod auth;
pub mod binance;
pub mod bots;
pub mod market;
pub mod monitoring;
pub mod orders;
pub mod positions;
pub mod settings;
pub mod sse;

#[derive(Clone)]
pub struct AppState {
    pub db: Db,
    pub binance_client: Arc<RwLock<Option<BinanceClient>>>,
    pub orchestrator: Arc<BotOrchestrator>,
    pub event_receiver: Arc<RwLock<mpsc::UnboundedReceiver<BotEvent>>>,
}

impl AppState {
    pub fn new(db: Db) -> Self {
        // Create event channel for orchestrator broadcasts
        let (event_sender, event_receiver) = mpsc::unbounded_channel::<BotEvent>();

        Self {
            db: db.clone(),
            binance_client: Arc::new(RwLock::new(None)),
            orchestrator: Arc::new(BotOrchestrator::new(db, event_sender)),
            event_receiver: Arc::new(RwLock::new(event_receiver)),
        }
    }

    pub fn db(&self) -> Db {
        self.db.clone()
    }
}

pub fn routes(app_state: AppState) -> Router<AppState> {
    // Public routes - no auth required
    let public_routes = Router::new()
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route("/market/btc-price", get(market::get_btc_price))
        .route("/market/price", get(market::get_market_price))
        .route("/market/list", get(market::list_markets))
        .route("/market/active", get(market::get_active_markets))
        .route("/events", get(sse::bot_events_stream));

    // Protected routes - require JWT auth
    let protected_routes = Router::new()
        .route("/auth/me", get(auth::me))
        .route("/bots", post(bots::create_bot))
        .route("/bots", get(bots::list_bots))
        .route("/bots/:id", get(bots::get_bot))
        .route("/bots/:id", put(bots::update_bot))
        .route("/bots/:id", delete(bots::delete_bot))
        .route("/bots/:id/start", post(bots::start_bot))
        .route("/bots/:id/stop", post(bots::stop_bot))
        .route("/bots/:id/session", get(bots::get_session))
        .route("/bots/:id/portfolio", get(bots::get_portfolio))
        .route("/bots/:id/history", get(bots::get_history))
        .route("/bots/:id/trades", get(bots::get_trades))
        .route("/bots/run-all", post(bots::run_all_bots))
        .route("/bots/stop-all", post(bots::stop_all_bots))
        .route("/portfolio", get(bots::get_aggregate_portfolio))
        .route("/bots/:id/status", get(monitoring::get_bot_status))
        .route("/orders", get(orders::list_orders))
        .route("/orders", post(orders::place_order))
        .route("/orders/cancel", post(orders::cancel_order))
        .route("/positions", get(positions::list_positions))
        .route("/positions/live", get(orders::get_live_positions))
        .route("/settings", get(settings::get_settings))
        .route("/settings", put(settings::update_settings))
        .route("/settings/validate", post(settings::validate_credentials))
        .route("/settings/derive", post(settings::derive_key))
        .route("/settings/validate-existing", post(settings::validate_existing))
        .route("/settings/validate-with-balance", post(settings::validate_with_balance))
        .route("/settings/store", post(settings::store_credentials))
        .route("/system/status", get(monitoring::get_system_status))
        .route("/system/logs", get(monitoring::get_logs))
        .route("/system/log", post(monitoring::log_activity))
        .route("/binance/start", post(binance::start_binance))
        .route("/binance/stop", post(binance::stop_binance))
        .route("/binance/price", get(binance::get_price))
        .layer(axum::middleware::from_fn_with_state(
            app_state.clone(),
            auth_middleware::auth_middleware,
        ));

    Router::new()
        .merge(public_routes)
        .merge(protected_routes)
}
