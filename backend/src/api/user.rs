use axum::{
    extract::{Extension, State},
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;

use super::AppState;
use crate::db;
use crate::middleware::auth::Claims;
use crate::trading::client::ClobClient;
use crate::trading::PolymarketClient;

#[derive(Serialize)]
pub struct UserBalanceResponse {
    pub balance: f64,
    pub wallet_address: String,
    pub has_credentials: bool,
    pub error: Option<String>,
}

/// GET /user/balance — Fetch real USDC balance from Polymarket API
pub async fn get_user_balance(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> Response {
    let user_id = claims.user_id;

    // Check credential cache first
    let cache = state.credential_cache.read().await;
    let creds = cache.get(&user_id).cloned();
    drop(cache);

    let creds = match creds {
        Some(c) => c,
        None => {
            // Cache miss — load from DB and populate cache
            if let Some(loaded) = load_credentials_from_db(&state, user_id).await {
                loaded
            } else {
                return Json(UserBalanceResponse {
                    balance: 0.0,
                    wallet_address: String::new(),
                    has_credentials: false,
                    error: Some("No Polymarket credentials configured. Add your API keys in Settings.".to_string()),
                })
                .into_response();
            }
        }
    };

    fetch_balance(&state, creds).await.into_response()
}

/// Load credentials from DB and populate cache. Returns Some(creds) on success.
async fn load_credentials_from_db(
    state: &AppState,
    user_id: i64,
) -> Option<crate::api::CachedCredentials> {
    let keys = db::queries::get_api_keys(&state.db, user_id).await.ok()?;

    let api_key = keys.iter().find(|k| k.key_name == "polymarket_api_key").map(|k| &k.key_value);
    let api_secret = keys.iter().find(|k| k.key_name == "polymarket_api_secret").map(|k| &k.key_value);
    let passphrase = keys.iter().find(|k| k.key_name == "polymarket_passphrase").map(|k| &k.key_value);

    let (key, secret, pass) = (api_key?, api_secret?, passphrase?);
    if key.is_empty() || secret.is_empty() || pass.is_empty() {
        return None;
    }

    let private_key = keys.iter().find(|k| k.key_name == "polymarket_private_key").map(|k| &k.key_value);
    let (pk, wallet) = if let Some(pk_val) = private_key {
        match PolymarketClient::new(pk_val) {
            Ok(client) => (pk_val.clone(), client.address()),
            Err(_) => (String::new(), String::new()),
        }
    } else {
        (String::new(), String::new())
    };

    let cached = crate::api::CachedCredentials {
        api_key: key.clone(),
        api_secret: secret.clone(),
        api_passphrase: pass.clone(),
        private_key: pk,
        funder: None,
        signature_type: 0,
        wallet_address: wallet,
    };

    tracing::info!("Loaded credentials from DB for user {}", user_id);
    state.credential_cache.write().await.insert(user_id, cached.clone());
    Some(cached)
}

/// Fetch balance from Polymarket CLOB API using cached credentials
async fn fetch_balance(state: &AppState, creds: crate::api::CachedCredentials) -> Response {
    if creds.api_key.is_empty() {
        return Json(UserBalanceResponse {
            balance: 0.0,
            wallet_address: creds.wallet_address.clone(),
            has_credentials: true,
            error: Some("Missing API key. Add your API key in Settings to see wallet balance.".to_string()),
        })
        .into_response();
    }

    let client = ClobClient::new(Some(creds.api_key.clone()));

    match client.get_balance().await {
        Ok(response) => {
            let usdc_balance = response.balances.iter()
                .find(|b| b.asset == "USDC" || b.asset == "PUSD")
                .map(|b| b.available)
                .unwrap_or(0.0);

            Json(UserBalanceResponse {
                balance: usdc_balance,
                wallet_address: creds.wallet_address.clone(),
                has_credentials: true,
                error: None,
            })
            .into_response()
        }
        Err(e) => Json(UserBalanceResponse {
            balance: 0.0,
            wallet_address: creds.wallet_address.clone(),
            has_credentials: true,
            error: Some(format!("Failed to fetch balance: {}", e)),
        })
        .into_response(),
    }
}
