use axum::{
    routing::get,
    Router,
};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod crypto;
mod db;
mod middleware;
mod services;
mod trading;

use api::AppState;
use crate::trading::orchestrator::BotEvent;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "polymarket_v2_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Polymarket V2 Backend");

    // Initialize database
    let db = db::init_db().await?;

    // Initialize app state with db and binance client
    let app_state = AppState::new(db);

    // Spawn event broadcaster: reads from orchestrator event_receiver and broadcasts to all SSE clients
    let event_receiver = app_state.event_receiver.clone();
    let bot_event_broadcaster = app_state.bot_event_broadcaster.clone();
    tokio::spawn(async move {
        tracing::info!("Event broadcaster started");
        loop {
            // Lock the RwLock to get mutable access to the underlying receiver
            let mut receiver_lock = event_receiver.write().await;
            // recv() returns Option<BotEvent> — None means channel closed
            match receiver_lock.recv().await {
                Some(event) => {
                    // Broadcast to all SSE subscribers (non-blocking; ignore if no subscribers)
                    let _ = bot_event_broadcaster.send(event);
                }
                None => {
                    tracing::error!("Orchestrator event channel closed");
                    break;
                }
            }
        }
        tracing::error!("Event broadcaster stopped");
    });

    // Start auto-save loop for running sessions
    let orchestrator = app_state.orchestrator.clone();
    tokio::spawn(async move {
        trading::orchestrator::start_auto_save_loop(orchestrator).await;
    });
    tracing::info!("Auto-save loop started (every 30 seconds)");

    // CORS layer
    let cors = CorsLayer::new()
        .allow_origin(tower_http::cors::Any)
        .allow_methods(tower_http::cors::Any)
        .allow_headers(tower_http::cors::Any);

    // Build app - need to clone app_state since it will be moved into both routes and with_state
    let api_router = api::routes(app_state.clone());

    let app = Router::new()
        .route("/health", get(health_check))
        .nest("/api", api_router)
        .layer(cors)
        .with_state(app_state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
