//! JWT Authentication Middleware
//!
//! Extracts and validates JWT tokens from requests

use axum::{
    body::Body,
    extract::Request,
    http::{header::AUTHORIZATION, StatusCode},
    middleware::Next,
    response::Response,
};
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    pub user_id: i64,
    pub username: String,
    pub exp: i64,
}

pub struct AuthConfig {
    pub secret: String,
    pub validation: Validation,
}

impl Default for AuthConfig {
    fn default() -> Self {
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "polymarket-v2-dev-secret-change-in-production".to_string());

        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;

        Self { secret, validation }
    }
}

impl AuthConfig {
    pub fn new(secret: &str) -> Self {
        let mut validation = Validation::new(Algorithm::HS256);
        validation.validate_exp = true;

        Self {
            secret: secret.to_string(),
            validation,
        }
    }
}

/// Extract token from Authorization header
pub fn extract_token(auth_value: &str) -> Option<String> {
    auth_value
        .strip_prefix("Bearer ")
        .or_else(|| auth_value.strip_prefix("bearer "))
        .map(|s| s.to_string())
}

/// Validate a JWT token and return claims
pub fn validate_token(token: &str, config: &AuthConfig) -> Result<Claims, String> {
    let decoding_key = DecodingKey::from_secret(config.secret.as_bytes());

    let token_data = decode::<Claims>(token, &decoding_key, &config.validation)
        .map_err(|e| format!("Token validation failed: {}", e))?;

    Ok(token_data.claims)
}

/// Get token from request headers
pub fn get_token_from_request(headers: &axum::http::HeaderMap) -> Option<String> {
    headers
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .and_then(extract_token)
}

/// Auth middleware function
pub async fn auth_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Skip auth for public endpoints
    let path = request.uri().path();
    if path.starts_with("/auth/")
        || path.starts_with("/market/")
        || path.starts_with("/binance/")
        || path == "/binance/price" {
        return Ok(next.run(request).await);
    }

    // Skip health check
    if path == "/health" || path == "/" {
        return Ok(next.run(request).await);
    }

    // Extract token
    let token = match get_token_from_request(request.headers()) {
        Some(t) => t,
        None => {
            return Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body(Body::from(r#"{"error":"Missing authorization header"}"#))
                .unwrap());
        }
    };

    // Validate token
    let config = AuthConfig::default();
    match validate_token(&token, &config) {
        Ok(claims) => {
            // Add claims to extensions for later extraction
            let mut extensions = request.extensions().clone();
            extensions.insert(claims);

            // Build new request with extensions - use parts to reconstruct
            let (parts, body) = request.into_parts();
            let mut new_parts = parts;
            new_parts.extensions = extensions;
            let new_request = Request::from_parts(new_parts, body);

            Ok(next.run(new_request).await)
        }
        Err(e) => {
            Ok(Response::builder()
                .status(StatusCode::UNAUTHORIZED)
                .body(Body::from(format!(r#"{{"error":"{}"}}"#, e)))
                .unwrap())
        }
    }
}

/// Extension trait to easily extract user from request
pub trait RequestUserExt {
    fn user_id(&self) -> Option<i64>;
    fn username(&self) -> Option<&str>;
}

impl RequestUserExt for Request<Body> {
    fn user_id(&self) -> Option<i64> {
        self.extensions().get::<Claims>().map(|c| c.user_id)
    }

    fn username(&self) -> Option<&str> {
        self.extensions().get::<Claims>().map(|c| c.username.as_str())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_token() {
        assert_eq!(
            extract_token("Bearer test_token"),
            Some("test_token".to_string())
        );
        assert_eq!(
            extract_token("bearer test_token"),
            Some("test_token".to_string())
        );
        assert_eq!(extract_token("test_token"), None);
    }
}
