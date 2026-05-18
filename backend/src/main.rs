#![allow(dead_code)]

use axum::{routing::get, Router};
use std::net::SocketAddr;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use sqlx::Row;

mod api;
mod crypto;
mod db;
mod middleware;
mod services;
mod trading;

use api::AppState;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    dotenv::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "polymarket_v2_backend=debug".into()))
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Polymarket V2 Backend");

    let db = db::init_db().await?;
    let app_state = AppState::new(db.clone());

    // === AUTO-LOAD CREDENTIALS ===
    {
        let pool = db.as_ref();
        let users = sqlx::query("SELECT id FROM users").fetch_all(pool).await.unwrap_or_default();
        for user_row in users {
            let user_id: i64 = user_row.get("id");
            if let Ok(keys) = db::queries::get_api_keys(&db, user_id).await {
                let pk = keys.iter().find(|k| k.key_name == "polymarket_private_key").map(|k| k.key_value.clone());
                if let Some(private_key) = pk {
                    let mut cache = app_state.credential_cache.write().await;
                    cache.insert(user_id, api::CachedCredentials {
                        api_key: keys.iter().find(|k| k.key_name == "polymarket_api_key").map(|k| k.key_value.clone()).unwrap_or_default(),
                        api_secret: keys.iter().find(|k| k.key_name == "polymarket_api_secret").map(|k| k.key_value.clone()).unwrap_or_default(),
                        api_passphrase: keys.iter().find(|k| k.key_name == "polymarket_passphrase").map(|k| k.key_value.clone()).unwrap_or_default(),
                        private_key, funder: None, signature_type: 0, wallet_address: String::new(),
                    });
                }
            }
        }
    }

    // // === AUTO-LOAD RUNNING BOTS ON STARTUP (bandi user only) ===
// // DISABLED - Bots must be started manually via POST /api/bots/:id/start
// {
//     const BANDI_USER_ID: i64 = 22; // bandi user_id in database
//     let pool = db.as_ref();
//     let active_bots = sqlx::query("SELECT id, user_id FROM bot_configs WHERE status = 'running' AND user_id = ?")
//         .bind(BANDI_USER_ID)
//         .fetch_all(pool).await.unwrap_or_default();
//
//     for bot_row in active_bots {
//         let bot_id: i64 = bot_row.get("id");
//         let user_id: i64 = bot_row.get("user_id");
//         
//         if let Ok(Some(bot_rec)) = db::queries::get_bot_by_id(&db, bot_id, user_id).await {
//             if let Ok(Some(portfolio)) = db::queries::get_portfolio(&db, bot_id, user_id).await {
//                 let _ = app_state.orchestrator.resume_bot(&bot_rec, portfolio.balance).await;
//                 let orch = app_state.orchestrator.clone();
//                 let cache = Some(app_state.credential_cache.clone());
//                 tokio::spawn(async move {
//                     trading::orchestrator::start_orchestrator_loop(orch, bot_id, user_id, 5, cache).await;
//                 });
//             }
//         }
//     }
// }

    // Event broadcaster
    let event_receiver = app_state.event_receiver.clone();
    let broadcaster = app_state.bot_event_broadcaster.clone();
    tokio::spawn(async move {
        let mut rx = event_receiver.write().await;
        while let Some(event) = rx.recv().await { let _ = broadcaster.send(event); }
    });

// Bot restore on startup - DISABLED 2026-05-17
// Bots must be started manually via POST /api/bots/:id/start
// Auto-restart on server crash caused confusion and duplicate sessions
//     let restore_orchestrator = app_state.orchestrator.clone();
//     tokio::spawn(async move {
//         trading::orchestrator::restore_running_bots(restore_orchestrator.clone(), 22).await;
//         trading::orchestrator::restore_running_bots(restore_orchestrator.clone(), 19).await;
//         trading::orchestrator::restore_running_bots(restore_orchestrator.clone(), 25).await;
//         trading::orchestrator::restore_running_bots(restore_orchestrator, 26).await;
//     });
//     tracing::info!("Bot restore from database started");

    // Auto-save loop
    let orch_save = app_state.orchestrator.clone();
    tokio::spawn(async move { trading::orchestrator::start_auto_save_loop(orch_save).await; });

    // Session timer monitor - checks for expired timers every 10 seconds
    let orch_timer = app_state.orchestrator.clone();
    let db_timer = db.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(10));
        loop {
            interval.tick().await;
            let users = sqlx::query("SELECT DISTINCT user_id FROM session_timers WHERE status = 'active'")
                .fetch_all(db_timer.as_ref()).await.unwrap_or_default();
            for row in users {
                let user_id: i64 = row.get("user_id");
                if let Ok(Some(timer)) = db::queries::get_active_session_timer(&db_timer, user_id).await {
                    let now = chrono::Utc::now().timestamp();
                    let ends_at = chrono::NaiveDateTime::parse_from_str(&timer.ends_at, "%Y-%m-%d %H:%M:%S")
                        .map(|dt| dt.and_utc().timestamp()).unwrap_or(0);
                    if now >= ends_at {
                        tracing::info!("Session timer {} expired for user {}, auto-stopping bots", timer.id, user_id);
                        let running = orch_timer.get_running_bots(user_id).await;
                        let bots_count = running.len();
                        for bot_id in running {
                            let _ = orch_timer.stop_bot(bot_id, user_id).await;
                        }
                        let summary = serde_json::json!({
                            "stopped_at": chrono::Utc::now().naive_utc().format("%Y-%m-%d %H:%M:%S").to_string(),
                            "duration_secs": timer.duration_secs,
                            "bots_stopped": bots_count
                        });
                        let _ = db::queries::expire_session_timer(&db_timer, timer.id, &summary.to_string(), true).await;
                    }
                }
            }
        }
    });

    // CORS layer

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .nest("/api", api::routes(app_state.clone()))
        .layer(CorsLayer::permissive())
        .with_state(app_state);

    let addr = SocketAddr::from(([0, 0, 0, 0], 3001));
    tracing::info!("Listening on {}", addr);
    axum::serve(tokio::net::TcpListener::bind(addr).await?, app).await?;
    Ok(())
}