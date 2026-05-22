use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::{providers, settings};

/// Tracks in-flight streams so they can be cancelled by id.
#[derive(Default, Clone)]
pub struct StreamRegistry(pub Arc<Mutex<HashMap<String, Arc<AtomicBool>>>>);

/// A base64-encoded image attached to a message, for vision models.
#[derive(Debug, Clone, Deserialize)]
pub struct ChatImage {
    pub mime: String,
    pub data: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub images: Vec<ChatImage>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatRequest {
    /// Provider id — used to look up the API key.
    pub provider: String,
    /// API shape: "anthropic", "openai" or "gemini".
    pub format: String,
    /// Endpoint URL (chat completions, or API base for Gemini).
    pub endpoint: String,
    pub model: String,
    #[serde(default)]
    pub system: Option<String>,
    pub messages: Vec<ChatMessage>,
    #[serde(default = "default_max_tokens")]
    pub max_tokens: u32,
}

fn default_max_tokens() -> u32 {
    4096
}

#[derive(Clone, Serialize)]
struct DonePayload {
    id: String,
}

#[derive(Clone, Serialize)]
struct ErrorPayload {
    id: String,
    message: String,
}

/// Starts a streaming completion. Returns immediately; tokens arrive via the
/// `stream://chunk`, `stream://done` and `stream://error` events.
#[tauri::command]
pub fn send_message(
    app: AppHandle,
    registry: State<StreamRegistry>,
    stream_id: String,
    request: ChatRequest,
) -> Result<(), String> {
    let settings = settings::load(&app);
    let cancel = Arc::new(AtomicBool::new(false));
    let reg = registry.0.clone();
    reg.lock().unwrap().insert(stream_id.clone(), cancel.clone());

    tauri::async_runtime::spawn(async move {
        let result = providers::stream_chat(&app, &stream_id, &settings, &request, cancel).await;
        match result {
            Ok(()) => {
                let _ = app.emit("stream://done", DonePayload { id: stream_id.clone() });
            }
            Err(message) => {
                let _ = app.emit(
                    "stream://error",
                    ErrorPayload {
                        id: stream_id.clone(),
                        message,
                    },
                );
            }
        }
        reg.lock().unwrap().remove(&stream_id);
    });

    Ok(())
}

/// Signals an in-flight stream to stop. The stream loop checks this flag
/// between chunks and exits cleanly.
#[tauri::command]
pub fn cancel_stream(registry: State<StreamRegistry>, stream_id: String) {
    if let Some(flag) = registry.0.lock().unwrap().get(&stream_id) {
        flag.store(true, Ordering::SeqCst);
    }
}
