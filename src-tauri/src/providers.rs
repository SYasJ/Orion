use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::chat::ChatRequest;
use crate::settings::Settings;

#[derive(Clone, Serialize)]
struct ChunkPayload {
    id: String,
    delta: String,
}

/// Streams a chat completion from the selected provider, emitting each text
/// delta to the frontend as a `stream://chunk` event.
pub async fn stream_chat(
    app: &AppHandle,
    stream_id: &str,
    settings: &Settings,
    request: &ChatRequest,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    let provider = request.provider.as_str();
    let client = reqwest::Client::new();

    let response = match provider {
        "anthropic" => {
            let key = require_key(&settings.anthropic_api_key, "Anthropic")?;
            client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&anthropic_body(request))
                .send()
                .await
        }
        "openai" => {
            let key = require_key(&settings.openai_api_key, "OpenAI")?;
            client
                .post("https://api.openai.com/v1/chat/completions")
                .header("authorization", format!("Bearer {key}"))
                .header("content-type", "application/json")
                .json(&openai_body(request))
                .send()
                .await
        }
        other => return Err(format!("Unknown provider: {other}")),
    }
    .map_err(|e| format!("Request failed: {e}"))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("{status} — {}", summarize_error(&body)));
    }

    let mut stream = response.bytes_stream();
    let mut buffer: Vec<u8> = Vec::new();

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            return Ok(());
        }
        let bytes = chunk.map_err(|e| format!("Stream error: {e}"))?;
        buffer.extend_from_slice(&bytes);

        // Process complete lines; partial multi-byte chars stay buffered.
        while let Some(pos) = buffer.iter().position(|&b| b == b'\n') {
            let line_bytes: Vec<u8> = buffer.drain(..=pos).collect();
            let line = String::from_utf8_lossy(&line_bytes);
            let line = line.trim();

            let Some(data) = line.strip_prefix("data:") else {
                continue;
            };
            let data = data.trim();
            if data.is_empty() {
                continue;
            }
            if data == "[DONE]" {
                return Ok(());
            }
            if let Ok(value) = serde_json::from_str::<Value>(data) {
                if let Some(delta) = extract_delta(provider, &value) {
                    if !delta.is_empty() {
                        let _ = app.emit(
                            "stream://chunk",
                            ChunkPayload {
                                id: stream_id.to_string(),
                                delta,
                            },
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

fn require_key<'a>(key: &'a str, label: &str) -> Result<&'a str, String> {
    if key.trim().is_empty() {
        Err(format!(
            "No {label} API key configured. Open Settings to add one."
        ))
    } else {
        Ok(key.trim())
    }
}

fn anthropic_body(request: &ChatRequest) -> Value {
    let messages: Vec<Value> = request
        .messages
        .iter()
        .map(|m| json!({ "role": m.role, "content": m.content }))
        .collect();

    let mut body = json!({
        "model": request.model,
        "max_tokens": request.max_tokens,
        "stream": true,
        "messages": messages,
    });

    if let Some(system) = request.system.as_deref() {
        if !system.trim().is_empty() {
            body["system"] = json!(system);
        }
    }
    body
}

fn openai_body(request: &ChatRequest) -> Value {
    let mut messages: Vec<Value> = Vec::new();
    if let Some(system) = request.system.as_deref() {
        if !system.trim().is_empty() {
            messages.push(json!({ "role": "system", "content": system }));
        }
    }
    for m in &request.messages {
        messages.push(json!({ "role": m.role, "content": m.content }));
    }

    json!({
        "model": request.model,
        "stream": true,
        "messages": messages,
    })
}

/// Extracts the incremental text from a single SSE data object.
fn extract_delta(provider: &str, value: &Value) -> Option<String> {
    match provider {
        "anthropic" => {
            if value.get("type")?.as_str()? == "content_block_delta" {
                Some(value.get("delta")?.get("text")?.as_str()?.to_string())
            } else {
                None
            }
        }
        _ => Some(
            value
                .get("choices")?
                .get(0)?
                .get("delta")?
                .get("content")?
                .as_str()?
                .to_string(),
        ),
    }
}

/// Pulls a human-readable message out of a provider error response body.
fn summarize_error(body: &str) -> String {
    serde_json::from_str::<Value>(body)
        .ok()
        .and_then(|v| {
            v.get("error")
                .and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .map(|s| s.to_string())
        })
        .unwrap_or_else(|| {
            if body.is_empty() {
                "request rejected".to_string()
            } else {
                body.chars().take(300).collect()
            }
        })
}
