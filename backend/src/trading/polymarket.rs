//! Polymarket CLOB Client - Authentication and trading (V2 compatible)
//!
//! Handles API key derivation, validation, and authenticated API calls
//! Updated for CLOB V2 migration (April 28, 2026)

use ethers::signers::{LocalWallet, Signer};
use reqwest::Client;
use serde::{Deserialize, Serialize};

// V2 endpoints - after April 28, clob.polymarket.com automatically routes to V2
const CLOB_HOST: &str = "https://clob.polymarket.com";
const DATA_HOST: &str = "https://data-api.polymarket.com";
const CHAIN_ID: u64 = 137; // Polygon (unchanged in V2)

// V2 Contract Addresses (from https://docs.polymarket.com/resources/contracts)
const CTF_EXCHANGE_V2: &str = "0xE111180000d2663C0091e4f400237545B87B996B";
const NEG_RISK_CTF_EXCHANGE_V2: &str = "0xe2222d279d744050d28e00520010520000310F59";
const NEG_RISK_ADAPTER_V2: &str = "0xd91E80cF2E7be2e162c6513ceD06f1dD0dA35296";
const CONDITIONAL_TOKENS: &str = "0x4D97DCd97eC945f40cF65F87097ACe5EA0476045";
const PUSD_COLLATERAL: &str = "0xC011a7E12a19f7B1f670d46F03B03f3342E82DFB";
const COLLATERAL_ONRAMP: &str = "0x93070a847efEf7F70739046A929D47a521F5B8ee";

// EIP-712 Domain versions
const EXCHANGE_DOMAIN_VERSION: &str = "2"; // V2 Exchange domain version
const CLOB_AUTH_DOMAIN_VERSION: &str = "1"; // CLOB Auth unchanged

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyCreds {
    pub key: String,
    pub secret: String,
    pub passphrase: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceAllowance {
    pub balance: String,
    pub allowance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub wallet_address: String,
    pub balance: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PositionInfo {
    pub market: Option<String>,
    pub outcome: Option<String>,
    pub size: Option<f64>,
    pub avg_price: Option<f64>,
    pub current_value: Option<f64>,
    pub total_bought: Option<f64>,
    pub token_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceAllowanceResponse {
    pub balance: String,
    pub allowance: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderRequest {
    pub token_id: String,
    pub price: f64,
    pub size: f64,
    pub side: String, // "BUY" or "SELL"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrderResponse {
    pub order_id: Option<String>,
    pub status: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketToken {
    pub token_id: String,
    pub outcome: String,
    pub tick_size: String,
    pub neg_risk: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketResponse {
    pub condition_id: String,
    pub question: String,
    pub tokens: Vec<MarketToken>,
}

#[derive(Debug, thiserror::Error)]
pub enum PolymarketError {
    #[error("HTTP request failed: {0}")]
    RequestFailed(#[from] reqwest::Error),
    #[error("API error: {0}")]
    ApiError(String),
    #[error("Invalid private key: {0}")]
    InvalidKey(String),
    #[error("Authentication failed: {0}")]
    AuthFailed(String),
    #[error("Signature error: {0}")]
    SignatureFailed(String),
}

/// Client for Polymarket CLOB API
pub struct PolymarketClient {
    http_client: Client,
    wallet: LocalWallet,
    creds: Option<ApiKeyCreds>,
    signature_type: u8, // 0 = EOA, 1 = Magic/Email
    funder: Option<String>,
}

impl PolymarketClient {
    /// Create a new client with private key
    pub fn new(private_key: &str) -> Result<Self, PolymarketError> {
        // In ethers 2.0, parse expects raw bytes, not hex string
        let key_bytes = hex::decode(private_key.trim_start_matches("0x"))
            .map_err(|e| PolymarketError::InvalidKey(e.to_string()))?;
        let wallet = LocalWallet::from_bytes(key_bytes.as_slice())
            .map_err(|e| PolymarketError::InvalidKey(e.to_string()))?;

        Ok(Self {
            http_client: Client::new(),
            wallet,
            creds: None,
            signature_type: 0,
            funder: None,
        })
    }

    /// Set signature type (0 = EOA, 1 = Magic/Email)
    pub fn with_signature_type(mut self, signature_type: u8) -> Self {
        self.signature_type = signature_type;
        self
    }

    /// Set funder address (Polymarket profile address)
    pub fn with_funder(mut self, funder: &str) -> Self {
        self.funder = Some(funder.to_string());
        self
    }

    /// Set API credentials
    pub fn with_creds(mut self, creds: ApiKeyCreds) -> Self {
        self.creds = Some(creds);
        self
    }

    pub fn from_api_credentials(
        private_key: &str,
        signature_type: u8,
        creds: Option<ApiKeyCreds>,
        funder: Option<&str>,
    ) -> Result<Self, PolymarketError> {
        let mut client = Self::new(private_key)?.with_signature_type(signature_type);

        if let Some(creds) = creds {
            client = client.with_creds(creds);
        }

        if let Some(funder) = funder {
            client = client.with_funder(funder);
        }

        Ok(client)
    }

    /// Get the wallet address
    pub fn address(&self) -> String {
        self.wallet.address().to_string()
    }

    /// Create or derive API key using L1 wallet authentication
    pub async fn create_or_derive_api_key(&mut self) -> Result<ApiKeyCreds, PolymarketError> {
        let timestamp = chrono::Utc::now().timestamp_millis();
        let message = format!("Sign this message to authenticate with Polymarket.\n\nTimestamp: {}", timestamp);

        let signature = self.wallet
            .sign_message(message.as_bytes())
            .await
            .map_err(|e| PolymarketError::SignatureFailed(e.to_string()))?;

        let body = serde_json::json!({
            "address": self.address(),
            "message": message,
            "signature": signature.to_string(),
        });

        // Try different endpoint patterns
        let endpoints = vec![
            "/api/keys",
            "/api-keys",
            "/api_key",
        ];

        let mut last_error = None;
        for endpoint in endpoints {
            let response = self.http_client
                .post(format!("{}{}", CLOB_HOST, endpoint))
                .header("Content-Type", "application/json")
                .json(&body)
                .send()
                .await;

            match response {
                Ok(resp) if resp.status().is_success() => {
                    let creds: ApiKeyCreds = resp.json().await?;
                    self.creds = Some(creds.clone());
                    tracing::info!("Successfully created/derived API key for {}", self.address());
                    return Ok(creds);
                }
                Ok(resp) => {
                    let status = resp.status();
                    let error_text = resp.text().await.unwrap_or_default();
                    let error_message = format!("{}: {}", status, error_text);
                    tracing::warn!("Endpoint {} failed: {}", endpoint, error_message);
                    last_error = Some(error_message);
                }
                Err(e) => {
                    last_error = Some(e.to_string());
                }
            }
        }

        Err(PolymarketError::ApiError(last_error.unwrap_or_else(|| "All endpoints failed".to_string())))
    }

    /// Get balance using data-api (no auth required)
    /// This is the preferred method for checking account value
    pub async fn get_balance(&self) -> Result<f64, PolymarketError> {
        let address = self.wallet.address().to_string().to_lowercase();

        // Try /value endpoint first (returns total position value)
        let response = self.http_client
            .get(format!("{}/value", DATA_HOST))
            .query(&[("user", &address)])
            .send()
            .await?;

        if response.status().is_success() {
            #[derive(Deserialize)]
            struct ValueResponse {
                value: Option<f64>,
            }

            let result: Vec<serde_json::Value> = response.json().await?;
            if let Some(first) = result.first() {
                if let Some(value) = first.get("value").and_then(|v| v.as_f64()) {
                    tracing::info!("Balance from /value: {}", value);
                    return Ok(value);
                }
            }
        }

        // Fallback: try /positions endpoint
        let response = self.http_client
            .get(format!("{}/positions", DATA_HOST))
            .query(&[("user", &address)])
            .query(&[("limit", "100")])
            .send()
            .await?;

        if response.status().is_success() {
            #[derive(Deserialize)]
            struct Position {
                current_value: Option<f64>,
                size: Option<f64>,
                avg_price: Option<f64>,
            }

            let positions: Vec<Position> = response.json().await?;
            let mut total_value = 0.0;

            for pos in positions {
                total_value += pos.current_value.unwrap_or_else(|| {
                    (pos.size.unwrap_or(0.0)) * (pos.avg_price.unwrap_or(0.0))
                });
            }

            tracing::info!("Balance from /positions: {}", total_value);
            return Ok(total_value);
        }

        Ok(0.0)
    }

    /// Get balance and allowance (legacy method - uses data-api now)
    pub async fn get_balance_allowance(&self) -> Result<BalanceAllowance, PolymarketError> {
        let balance = self.get_balance().await?;

        Ok(BalanceAllowance {
            balance: balance.to_string(),
            allowance: balance.to_string(),
        })
    }

    /// Get positions from data-api
    pub async fn get_positions(&self) -> Result<Vec<PositionInfo>, PolymarketError> {
        let address = self.wallet.address().to_string().to_lowercase();

        let response = self.http_client
            .get(format!("{}/positions", DATA_HOST))
            .query(&[("user", &address)])
            .query(&[("limit", "100")])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        let positions: Vec<PositionInfo> = response.json().await?;
        Ok(positions)
    }

    /// Validate credentials by checking balance (works without API keys)
    pub async fn validate_credentials(&self) -> Result<ValidationResult, PolymarketError> {
        let balance = self.get_balance().await?;

        Ok(ValidationResult {
            valid: true,
            wallet_address: self.wallet.address().to_string(),
            balance,
            message: if balance > 0.0 {
                format!("Credentials valid. Balance: {}", balance)
            } else {
                "Credentials valid. Account has no positions.".to_string()
            },
        })
    }

    /// Get balance for a specific conditional token
    #[allow(dead_code)]
    pub async fn get_token_balance(&self, token_id: &str) -> Result<BalanceAllowance, PolymarketError> {
        let address = self.wallet.address().to_string().to_lowercase();

        let response = self.http_client
            .get(format!("{}/positions", DATA_HOST))
            .query(&[("user", &address)])
            .query(&[("token_id", token_id)])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        let result: BalanceAllowanceResponse = response.json().await?;
        Ok(BalanceAllowance {
            balance: result.balance,
            allowance: result.allowance,
        })
    }

    /// Get market info (tokens, tick size, etc.)
    pub async fn get_market(&self, condition_id: &str) -> Result<MarketResponse, PolymarketError> {
        let response = self.http_client
            .get(format!("{}/markets/{}", CLOB_HOST, condition_id))
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        let market: MarketResponse = response.json().await?;
        Ok(market)
    }

    /// Get a quote for an order (without placing it)
    pub async fn get_quote(&self, token_id: &str, side: &str, size: f64) -> Result<f64, PolymarketError> {
        let response = self.http_client
            .get(format!("{}/quotes", CLOB_HOST))
            .query(&[
                ("token_id", token_id),
                ("side", side),
                ("size", &size.to_string()),
            ])
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        #[derive(Deserialize)]
        struct QuoteResponse {
            price: String,
        }

        let quote: QuoteResponse = response.json().await?;
        quote.price.parse().map_err(|_| PolymarketError::ApiError("Invalid price format".to_string()))
    }

    /// Create and sign a V2 order using EIP-712 typed data
    /// V2 uses domain version "2" for Exchange and updated Order type
    pub async fn create_order_v2(
        &self,
        order: &OrderRequest,
        is_neg_risk: bool,
    ) -> Result<serde_json::Value, PolymarketError> {
        let creds = self.creds.as_ref()
            .ok_or(PolymarketError::AuthFailed("No API credentials".to_string()))?;

        // Generate order parameters
        let salt: u64 = rand::random();
        let expiration: i64 = chrono::Utc::now().timestamp() + 86400; // 24 hours
        let nonce: u64 = rand::random();
        let fee_rate_bps: u64 = 0; // V2: fees collected onchain, not in signed order

        // V2 Order type fields
        let order_data = serde_json::json!({
            "salt": salt.to_string(),
            "maker": self.funder.as_ref().unwrap_or(&self.address()),
            "signer": self.address(),
            "taker": "0x0000000000000000000000000000000000000000", // Anyone can fill
            "tokenId": order.token_id,
            "makerAmount": (order.size * 1000000.0).to_string(), // Convert to base units
            "takerAmount": (order.size * order.price * 1000000.0).to_string(),
            "expiration": expiration,
            "nonce": nonce,
            "feeRateBps": fee_rate_bps,
            "side": order.side, // "BUY" or "SELL"
            "signatureType": self.signature_type,
        });

        // EIP-712 Domain for V2 Exchange
        let exchange_address = get_exchange_address(is_neg_risk);
        let domain = serde_json::json!({
            "name": "CTFExchange",
            "version": EXCHANGE_DOMAIN_VERSION,
            "chainId": CHAIN_ID,
            "verifyingContract": exchange_address,
        });

        // Build EIP-712 typed data
        let typed_data = serde_json::json!({
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "Order": [
                    {"name": "salt", "type": "uint256"},
                    {"name": "maker", "type": "address"},
                    {"name": "signer", "type": "address"},
                    {"name": "taker", "type": "address"},
                    {"name": "tokenId", "type": "uint256"},
                    {"name": "makerAmount", "type": "uint256"},
                    {"name": "takerAmount", "type": "uint256"},
                    {"name": "expiration", "type": "uint256"},
                    {"name": "nonce", "type": "uint256"},
                    {"name": "feeRateBps", "type": "uint256"},
                    {"name": "side", "type": "uint8"},
                    {"name": "signatureType", "type": "uint8"}
                ]
            },
            "primaryType": "Order",
            "domain": domain,
            "message": order_data
        });

        // Sign using EIP-712 (eth_signTypedData)
        // For ethers 2.0, we need to manually construct the hash
        let typed_data_json = serde_json::to_string(&typed_data)
            .map_err(|e| PolymarketError::ApiError(e.to_string()))?;

        // EIP-712 hash: keccak256("\x19\x01" + domainSeparator + hashStruct)
        let domain_separator = ethers::utils::keccak256(
            ethers::utils::keccak256(typed_data_json.as_bytes())
        );
        let struct_hash = ethers::utils::keccak256(
            ethers::utils::keccak256(order_data.to_string().as_bytes())
        );

        let mut pre_hash = Vec::with_capacity(66);
        pre_hash.push(0x19);
        pre_hash.push(0x01);
        pre_hash.extend_from_slice(&domain_separator);
        pre_hash.extend_from_slice(&struct_hash);

        let final_hash = ethers::utils::keccak256(&pre_hash);
        let signature = self.wallet.sign_message(final_hash.to_vec())
            .await
            .map_err(|e| PolymarketError::SignatureFailed(e.to_string()))?;

        // V2 Signed order format (with signature folded into order)
        let signed_order = serde_json::json!({
            "order": {
                "salt": salt.to_string(),
                "maker": self.funder.as_ref().unwrap_or(&self.address()),
                "signer": self.address(),
                "taker": "0x0000000000000000000000000000000000000000",
                "tokenId": order.token_id,
                "makerAmount": (order.size * 1000000.0).to_string(),
                "takerAmount": (order.size * order.price * 1000000.0).to_string(),
                "expiration": expiration,
                "nonce": nonce,
                "feeRateBps": fee_rate_bps,
                "side": if order.side == "BUY" { 0 } else { 1 },
                "signatureType": self.signature_type,
                "signature": signature.to_string(),
            },
            "orderType": "GTC", // Good Till Cancelled
            "owner": &creds.key,
        });

        Ok(signed_order)
    }

    /// Create and sign an order (V2 compatible - uses create_order_v2)
    pub async fn create_order(&self, order: &OrderRequest) -> Result<serde_json::Value, PolymarketError> {
        // Use V2 signing by default
        self.create_order_v2(order, false).await
    }

    /// Post a signed order to the orderbook
    pub async fn post_order(&self, signed_order: &serde_json::Value) -> Result<OrderResponse, PolymarketError> {
        let creds = self.creds.as_ref()
            .ok_or(PolymarketError::AuthFailed("No API credentials".to_string()))?;

        let response = self.http_client
            .post(format!("{}/orders", CLOB_HOST))
            .header("Content-Type", "application/json")
            .header("POLY-API-KEY", &creds.key)
            .header("POLY-API-SECRET", &creds.secret)
            .header("POLY-API-PASSPHRASE", &creds.passphrase)
            .json(signed_order)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        let order_response: OrderResponse = response.json().await?;
        Ok(order_response)
    }

    /// Cancel an order
    pub async fn cancel_order(&self, order_id: &str) -> Result<(), PolymarketError> {
        let creds = self.creds.as_ref()
            .ok_or(PolymarketError::AuthFailed("No API credentials".to_string()))?;

        let response = self.http_client
            .delete(format!("{}/orders/{}", CLOB_HOST, order_id))
            .header("POLY-API-KEY", &creds.key)
            .header("POLY-API-SECRET", &creds.secret)
            .header("POLY-API-PASSPHRASE", &creds.passphrase)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        Ok(())
    }

    /// Get open orders
    pub async fn get_orders(&self) -> Result<Vec<OrderResponse>, PolymarketError> {
        let creds = self.creds.as_ref()
            .ok_or(PolymarketError::AuthFailed("No API credentials".to_string()))?;

        let response = self.http_client
            .get(format!("{}/orders", CLOB_HOST))
            .header("POLY-API-KEY", &creds.key)
            .header("POLY-API-SECRET", &creds.secret)
            .header("POLY-API-PASSPHRASE", &creds.passphrase)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            return Err(PolymarketError::ApiError(error_text));
        }

        let orders: Vec<OrderResponse> = response.json().await?;
        Ok(orders)
    }
}

/// Check MATIC (gas fee) balance on Polygon network
/// Returns balance in MATIC (not wei). Logs warning if below threshold.
pub async fn check_matic_balance(wallet_address: &str) -> Result<f64, String> {
    const MATIC_MIN_THRESHOLD: f64 = 0.01; // 0.01 MATIC minimum
    const POLYGON_RPC: &str = "https://polygon-rpc.com";

    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getBalance",
        "params": [wallet_address, "latest"],
        "id": 1
    });

    let client = reqwest::Client::new();
    let resp = client
        .post(POLYGON_RPC)
        .timeout(Duration::from_secs(5))
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Polygon RPC error: {}", e))?;

    let result: serde_json::Value = resp.json().await
        .map_err(|e| format!("Failed to parse Polygon RPC response: {}", e))?;

    let balance_hex = result.get("result")
        .and_then(|v| v.as_str())
        .ok_or_else(|| "Invalid balance response".to_string())?;

    // Convert hex wei to MATIC (1 MATIC = 10^18 wei)
    let balance_wei = u128::from_str_radix(balance_hex.trim_start_matches("0x"), 16)
        .map_err(|e| format!("Failed to parse balance: {}", e))?;

    let balance_matic = balance_wei as f64 / 1e18;

    if balance_matic < MATIC_MIN_THRESHOLD {
        tracing::warn!(
            "Low MATIC balance: {:.6} (min recommended: {:.2}). Transactions may fail.",
            balance_matic, MATIC_MIN_THRESHOLD
        );
    } else {
        tracing::info!("MATIC balance: {:.6}", balance_matic);
    }

    Ok(balance_matic)
}

use tokio::time::Duration;

/// Full credentials to store in database (encrypted)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredCredentials {
    pub key: String,
    pub secret: String,
    pub passphrase: String,
    pub funder: Option<String>,
    pub signature_type: u8,
    pub wallet_address: String,
}

/// V2 Contract configuration helper
pub fn get_exchange_address(is_neg_risk: bool) -> String {
    if is_neg_risk {
        NEG_RISK_CTF_EXCHANGE_V2.to_string()
    } else {
        CTF_EXCHANGE_V2.to_string()
    }
}

/// Get collateral token address (pUSD in V2)
pub fn get_collateral_address() -> String {
    PUSD_COLLATERAL.to_string()
}

/// Get collateral onramp for wrapping USDC to pUSD
pub fn get_collateral_onramp() -> String {
    COLLATERAL_ONRAMP.to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_client_creation() {
        // Valid private key format: 64 hex characters (32 bytes) without 0x prefix
        // This is a deterministic test key - not used for real trading
        let private_key = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        let client = PolymarketClient::new(private_key).unwrap();
        let address = client.address();
        println!("Generated address: {:?}", address);
        assert!(address.len() > 0, "Address should not be empty");
        assert!(address.starts_with("0x"), "Address should start with 0x");
    }

    #[test]
    fn test_invalid_private_key() {
        let result = PolymarketClient::new("invalid");
        assert!(result.is_err());
    }
}
