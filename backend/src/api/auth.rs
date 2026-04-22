use axum::{
    extract::State,
    response::{IntoResponse, Json, Response},
};
use serde::{Deserialize, Serialize};

use crate::db::queries;
use super::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user_id: i64,
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: i64,
    pub username: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
}

pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Response {
    let db = state.db();

    // Validate input
    if payload.username.len() < 3 {
        return Json(ErrorResponse {
            error: "Username must be at least 3 characters".to_string(),
        })
        .into_response();
    }

    if payload.password.len() < 6 {
        return Json(ErrorResponse {
            error: "Password must be at least 6 characters".to_string(),
        })
        .into_response();
    }

    // Check if user exists
    match queries::find_user_by_username(&db, &payload.username).await {
        Ok(Some(_)) => {
            return Json(ErrorResponse {
                error: "Username already exists".to_string(),
            })
            .into_response();
        }
        Err(e) => {
            tracing::error!("Database error: {}", e);
            return Json(ErrorResponse {
                error: "Internal server error".to_string(),
            })
            .into_response();
        }
        _ => {}
    }

    // Hash password
    let password_hash = match bcrypt::hash(&payload.password, 12) {
        Ok(hash) => hash,
        Err(e) => {
            tracing::error!("Password hashing error: {}", e);
            return Json(ErrorResponse {
                error: "Internal server error".to_string(),
            })
            .into_response();
        }
    };

    // Create user
    match queries::create_user(&db, &payload.username, &password_hash).await {
        Ok(user_id) => {
            // Generate token
            match generate_token(user_id, &payload.username) {
                Ok(token) => Json(AuthResponse {
                    token,
                    user_id,
                    username: payload.username,
                })
                .into_response(),
                Err(e) => {
                    tracing::error!("Token generation error: {}", e);
                    Json(ErrorResponse {
                        error: "Internal server error".to_string(),
                    })
                    .into_response()
                }
            }
        }
        Err(e) => {
            tracing::error!("User creation error: {}", e);
            Json(ErrorResponse {
                error: "Internal server error".to_string(),
            })
            .into_response()
        }
    }
}

pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Response {
    let db = state.db();

    // Find user
    let user = match queries::find_user_by_username(&db, &payload.username).await {
        Ok(Some(user)) => user,
        Ok(None) => {
            return Json(ErrorResponse {
                error: "Invalid username or password".to_string(),
            })
            .into_response();
        }
        Err(e) => {
            tracing::error!("Database error: {}", e);
            return Json(ErrorResponse {
                error: "Internal server error".to_string(),
            })
            .into_response();
        }
    };

    // Verify password
    match bcrypt::verify(&payload.password, &user.2) {
        Ok(true) => {}
        Ok(false) => {
            return Json(ErrorResponse {
                error: "Invalid username or password".to_string(),
            })
            .into_response();
        }
        Err(e) => {
            tracing::error!("Password verification error: {}", e);
            return Json(ErrorResponse {
                error: "Internal server error".to_string(),
            })
            .into_response();
        }
    };

    // Generate token
    match generate_token(user.0, &user.1) {
        Ok(token) => Json(AuthResponse {
            token,
            user_id: user.0,
            username: user.1,
        })
        .into_response(),
        Err(e) => {
            tracing::error!("Token generation error: {}", e);
            Json(ErrorResponse {
                error: "Internal server error".to_string(),
            })
            .into_response()
        }
    }
}

pub async fn me(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> Response {
    let db = state.db();

    // This will be protected by auth middleware - user_id from token
    let user_id = payload.get("user_id").and_then(|v| v.as_i64()).unwrap_or(0);

    match queries::find_user_by_id(&db, user_id).await {
        Ok(Some((id, username))) => Json(UserResponse { id, username }).into_response(),
        Ok(None) => Json(ErrorResponse { error: "User not found".to_string() }).into_response(),
        Err(e) => {
            tracing::error!("Database error: {}", e);
            Json(ErrorResponse { error: "Internal server error".to_string() }).into_response()
        }
    }
}

// JWT helpers
fn generate_token(user_id: i64, username: &str) -> Result<String, jsonwebtoken::errors::Error> {
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    #[derive(Serialize)]
    struct Claims<'a> {
        user_id: i64,
        username: &'a str,
        exp: i64,
    }

    let secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "polymarket-v2-dev-secret-change-in-production".to_string());

    let exp = chrono::Utc::now()
        .checked_add_signed(chrono::Duration::hours(24))
        .unwrap()
        .timestamp();

    let claims = Claims {
        user_id,
        username,
        exp,
    };

    encode(
        &Header::new(jsonwebtoken::Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
}
