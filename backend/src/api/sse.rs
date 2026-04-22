//! Server-Sent Events for real-time bot updates

use axum::{
    extract::State,
    response::{
        sse::{Event, KeepAlive, Sse},
        IntoResponse,
    },
};
use futures_util::stream::Stream;
use std::convert::Infallible;
use std::pin::Pin;
use std::task::{Context, Poll};

use crate::trading::orchestrator::BotEvent;
use super::AppState;

/// SSE stream for bot events - simple heartbeat with status updates
pub async fn bot_events_stream(
    State(state): State<AppState>,
) -> Sse<impl Stream<Item = Result<Event, Infallible>>> {
    let state_clone = state.clone();

    // Create a custom stream using async_stream
    let stream = async_stream::stream! {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(5));
        loop {
            interval.tick().await;

            // Get running bots count
            let running_bots = state_clone.orchestrator.get_running_bots(0).await.len();
            let timestamp = chrono::Utc::now().to_rfc3339();

            let status_update = serde_json::json!({
                "type": "status",
                "running_bots": running_bots,
                "timestamp": timestamp
            });

            yield Ok(Event::default()
                .event("status")
                .data(status_update.to_string()));
        }
    };

    Sse::new(stream).keep_alive(KeepAlive::default())
}