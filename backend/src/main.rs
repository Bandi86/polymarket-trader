#![allow(dead_code)]

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
use sqlx::Row;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Load .env file FIRST - before anything else
    dotenv::dotenv().ok();

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
    let app_state = AppState::new(db.clone());

    // === AUTO-LOAD CREDENTIALS FROM DATABASE ON STARTUP ===
    // This ensures credentials survive backend restarts
    {
        let pool = db.as_ref();
        
        // Get all users directly
        let users = sqlx::query("SELECT id, username FROM users")
            .fetch_all(pool)
            .await
            .unwrap_or_default();
            
        tracing::info!("Loading credentials for {} users on startup", users.len());
        
        for user_row in users {
            let user_id: i64 = user_row.get("id");
            
            match db::queries::get_api_keys(&db, user_id).await {
                Ok(keys) => {
                    let api_key = keys.iter().find(|k| k.key_name == "polymarket_api_key").map(|k| k.key_value.clone());
                    let api_secret = keys.iter().find(|k| k.key_name == "polymarket_api_secret").map(|k| k.key_value.clone());
                    let passphrase = keys.iter().find(|k| k.key_name == "polymarket_passphrase").map(|k| k.key_value.clone());
                    let private_key = keys.iter().find(|k| k.key_name == "polymarket_private_key").map(|k| k.key_value.clone());

                    if let (Some(key), Some(secret), Some(pass), Some(pk)) = (api_key, api_secret, passphrase, private_key) {
                        if key.len() > 5 && secret.len() > 5 && pass.len() > 5 && pk.len() > 5 {
                            let wallet_address = match trading::polymarket::PolymarketClient::new(&pk) {
                                Ok(client) => client.address(),
                                Err(e) => {
                                    tracing::warn!("Failed to derive wallet for user {}: {}", user_id, e);
                                    String::new()
                                }
                            };

                            let mut cache = app_state.credential_cache.write().await;
                            cache.insert(user_id, api::CachedCredentials {
                                api_key: key.clone(),
                                api_secret: secret.clone(),
                                api_passphrase: pass.clone(),
                                private_key: pk.clone(),
                                funder: None,
                                signature_type: 0,
                                wallet_address: wallet_address.clone(),
                            });
                            drop(cache);

                            tracing::info!("Loaded credentials for user {} on startup", user_id);
                        }
                    }
                }
                Err(e) => {
                    tracing::warn!("Failed to load api_keys for user {}: {}", user_id, e);
                }
            }
        }
    }

    // Spawn event broadcaster
    let event_receiver = app_state.event_receiver.clone();
    let bot_event_broadcaster = app_state.bot_event_broadcaster.clone();
    tokio::spawn(async move {
        tracing::info!("Event broadcaster started");
        loop {
            let mut receiver_lock = event_receiver.write().await;
            match receiver_lock.recv().await {
                Some(event) => {
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

    let api_router = api::routes(app_state.clone());

    let app = Router::new()
        .route("/health", get(health_check))
        .nest("/api", api_router)
        .layer(cors)
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

async fn health_check() -> &'static str {
    "OK"
}
