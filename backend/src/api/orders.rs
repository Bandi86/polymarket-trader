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
