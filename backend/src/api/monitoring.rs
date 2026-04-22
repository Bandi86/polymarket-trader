//! System monitoring endpoints
//!
//! Provides system status, bot health, and activity logs

use axum::{
    extract::{Extension, Path, State},
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};
use sqlx::Row;

use crate::db::queries;
use crate::middleware::auth::Claims;
use super::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// Get system status (binance, balance, etc.)
pub async fn get_system_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(_payload): Json<serde_json::Value>,
) -> Response {
    let db = state.db();

    let user_id = claims.user_id;

    // Check Binance connection
    let binance_client = state.binance_client.read().await;
    let binance_connected = binance_client.is_some();
    let btc_price = if binance_client.is_some() {
        binance_client.as_ref().unwrap().get_current_price().await
    } else {
        None
    };

    // Get stored credentials info
    let settings = queries::get_settings(&db, user_id).await.ok().flatten();
    let (api_key, has_creds) = match settings {
        Some((key, blob)) => (Some(key), !blob.is_empty()),
        None => (None, false),
    };

    // Get bot count
    let bots = queries::get_bots_by_user(&db, user_id).await.unwrap_or_default();
    let running_bots = bots.iter().filter(|b| b.status == "running").count();
    let total_bots = bots.len();

    #[derive(Serialize)]
    struct SystemStatus {
        binance_connected: bool,
        btc_price: Option<f64>,
        has_polymarket_credentials: bool,
        polymarket_api_key: Option<String>,
        total_bots: usize,
        running_bots: usize,
    }

    Json(SystemStatus {
        binance_connected,
        btc_price,
        has_polymarket_credentials: has_creds,
        polymarket_api_key: api_key.map(|k| format!("{}...", &k[..8.min(k.len())])),
        total_bots,
        running_bots,
    }).into_response()
}

/// Get activity logs for a user or bot
#[derive(Debug, Serialize, Deserialize)]
pub struct GetLogsRequest {
    pub bot_id: Option<i64>,
    pub level: Option<String>,
    pub limit: Option<i64>,
}

pub async fn get_logs(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<GetLogsRequest>,
) -> Response {
    let db = state.db();

    let user_id = claims.user_id;
    let limit = payload.limit.unwrap_or(50);

    // Build query based on filters
    let mut query = String::from(
        "SELECT id, user_id, bot_id, level, message, metadata, created_at FROM activity_log WHERE user_id = ?"
    );

    if payload.bot_id.is_some() {
        query.push_str(" AND bot_id = ?");
    }

    if payload.level.is_some() {
        query.push_str(" AND level = ?");
    }

    query.push_str(" ORDER BY created_at DESC LIMIT ?");

    // Execute query
    let mut q = sqlx::query(&query).bind(user_id);

    if let Some(bot_id) = payload.bot_id {
        q = q.bind(bot_id);
    }

    if let Some(ref level) = payload.level {
        q = q.bind(level);
    }

    let rows = match q.bind(limit).fetch_all(db.as_ref()).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!("Failed to get activity logs: {}", e);
            return Json(ErrorResponse {
                error: "Failed to get activity logs".to_string(),
            }).into_response();
        }
    };

    #[derive(Serialize)]
    struct LogEntry {
        id: i64,
        bot_id: Option<i64>,
        level: String,
        message: String,
        metadata: Option<String>,
        created_at: String,
    }

    let entries: Vec<LogEntry> = rows.into_iter().map(|row| LogEntry {
        id: row.get("id"),
        bot_id: row.get("bot_id"),
        level: row.get("level"),
        message: row.get("message"),
        metadata: row.get("metadata"),
        created_at: row.get("created_at"),
    }).collect();

    Json(entries).into_response()
}

/// Add activity log entry (internal use)
pub async fn log_activity(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let db = state.db();

    let user_id = claims.user_id;
    let bot_id = payload.get("bot_id").and_then(|v| v.as_i64());
    let level = payload.get("level").and_then(|v| v.as_str()).unwrap_or("INFO");
    let message = payload.get("message").and_then(|v| v.as_str()).unwrap_or("");
    let metadata = payload.get("metadata").and_then(|v| v.as_str());

    // Insert into activity_log
    let result = sqlx::query(
        "INSERT INTO activity_log (user_id, bot_id, level, message, metadata) VALUES (?, ?, ?, ?, ?)"
    )
    .bind(user_id)
    .bind(bot_id)
    .bind(level)
    .bind(message)
    .bind(metadata)
    .execute(db.as_ref())
    .await;

    match result {
        Ok(_) => Json(serde_json::json!({"success": true})).into_response(),
        Err(e) => {
            tracing::error!("Failed to log activity: {}", e);
            Json(ErrorResponse {
                error: "Failed to log activity".to_string(),
            }).into_response()
        }
    }
}

/// Get bot status with detailed info
#[derive(Debug, Serialize, Deserialize)]
pub struct BotDetailedStatus {
    pub id: i64,
    pub name: String,
    pub status: String,
    pub strategy: String,
    pub market_id: String,
    pub created_at: String,
    pub last_error: Option<String>,
    pub last_activity: Option<String>,
}

pub async fn get_bot_status(
    Path((id,)): Path<(i64,)>,
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let db = state.db();
    let user_id = claims.user_id;

    match queries::get_bot_by_id(&db, id, user_id).await {
        Ok(Some(bot)) => {
            // Get recent logs for this bot
            // For now, return basic info
            Json(BotDetailedStatus {
                id: bot.id,
                name: bot.name,
                status: bot.status,
                strategy: bot.strategy_type,
                market_id: bot.market_id,
                created_at: bot.created_at,
                last_error: None,
                last_activity: None,
            }).into_response()
        }
        Ok(None) => Json(ErrorResponse {
            error: "Bot not found".to_string(),
        }).into_response(),
        Err(e) => {
            tracing::error!("Failed to get bot status: {}", e);
            Json(ErrorResponse {
                error: "Failed to get bot status".to_string(),
            }).into_response()
        }
    }
}
