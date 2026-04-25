use axum::{
    extract::{Extension, State},
    response::{IntoResponse, Json, Response},
};
use serde::Serialize;

use super::AppState;
use crate::middleware::auth::Claims;
use crate::trading::client::ClobClient;

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

    let Some(creds) = creds else {
        return Json(UserBalanceResponse {
            balance: 0.0,
            wallet_address: String::new(),
            has_credentials: false,
            error: Some("No Polymarket credentials configured. Add your API keys in Settings.".to_string()),
        })
        .into_response();
    };

    if creds.api_key.is_empty() {
        return Json(UserBalanceResponse {
            balance: 0.0,
            wallet_address: creds.wallet_address.clone(),
            has_credentials: true,
            error: Some("Missing API key. Add your API key in Settings to see wallet balance.".to_string()),
        })
        .into_response();
    }

    // Create CLOB client with API key to fetch balance
    let client = ClobClient::new(Some(creds.api_key.clone()));

    match client.get_balance().await {
        Ok(response) => {
            // Find USDC balance (asset "USDC" or "PUSD" depending on collateral)
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
