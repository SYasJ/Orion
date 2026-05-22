use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use futures_util::StreamExt;
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};

use crate::chat::{ChatMessage, ChatRequest};
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
    let key = settings
        .keys
        .get(&request.provider)
        .map(|k| k.trim())
        .filter(|k| !k.is_empty())
        .ok_or_else(|| {
            format!(
                "No API key configured for '{}'. Open Settings to add one.",
                request.provider
            )
        })?;

    let client = reqwest::Client::new();
    let format = request.format.as_str();

    let builder = match format {
        "anthropic" => client
            .post(&request.endpoint)
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01")
            .header("content-type", "application/json")
            .json(&anthropic_body(request)),
        "gemini" => {
            let url = format!(
                "{}/models/{}:streamGenerateContent?alt=sse",
                request.endpoint.trim_end_matches('/'),
                request.model
            );
            client
                .post(url)
                .header("x-goog-api-key", key)
                .header("content-type", "application/json")
                .json(&gemini_body(request))
        }
        "openai" => client
            .post(&request.endpoint)
            .header("authorization", format!("Bearer {key}"))
            .header("content-type", "application/json")
            // Recommended by OpenRouter; harmless for other OpenAI-compatible APIs.
            .header("http-referer", "https://orion.app")
            .header("x-title", "Orion")
            .json(&openai_body(request)),
        other => return Err(format!("Unknown API format: {other}")),
    };

    let response = builder
        .send()
        .await
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
                if let Some(delta) = extract_delta(format, &value) {
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

// ---- request bodies ------------------------------------------------------

fn anthropic_content(m: &ChatMessage) -> Value {
    if m.images.is_empty() {
        return json!(m.content);
    }
    let mut parts: Vec<Value> = m
        .images
        .iter()
        .map(|img| {
            json!({
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": img.mime,
                    "data": img.data,
                },
            })
        })
        .collect();
    if !m.content.is_empty() {
        parts.push(json!({ "type": "text", "text": m.content }));
    }
    json!(parts)
}

fn anthropic_body(request: &ChatRequest) -> Value {
    let messages: Vec<Value> = request
        .messages
        .iter()
        .map(|m| json!({ "role": m.role, "content": anthropic_content(m) }))
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

fn openai_content(m: &ChatMessage) -> Value {
    if m.images.is_empty() {
        return json!(m.content);
    }
    let mut parts: Vec<Value> = Vec::new();
    if !m.content.is_empty() {
        parts.push(json!({ "type": "text", "text": m.content }));
    }
    for img in &m.images {
        parts.push(json!({
            "type": "image_url",
            "image_url": { "url": format!("data:{};base64,{}", img.mime, img.data) },
        }));
    }
    json!(parts)
}

fn openai_body(request: &ChatRequest) -> Value {
    let mut messages: Vec<Value> = Vec::new();
    if let Some(system) = request.system.as_deref() {
        if !system.trim().is_empty() {
            messages.push(json!({ "role": "system", "content": system }));
        }
    }
    for m in &request.messages {
        messages.push(json!({ "role": m.role, "content": openai_content(m) }));
    }
    json!({
        "model": request.model,
        "stream": true,
        "messages": messages,
    })
}

fn gemini_parts(m: &ChatMessage) -> Vec<Value> {
    let mut parts: Vec<Value> = Vec::new();
    if !m.content.is_empty() {
        parts.push(json!({ "text": m.content }));
    }
    for img in &m.images {
        parts.push(json!({
            "inline_data": { "mime_type": img.mime, "data": img.data },
        }));
    }
    if parts.is_empty() {
        parts.push(json!({ "text": "" }));
    }
    parts
}

fn gemini_body(request: &ChatRequest) -> Value {
    let contents: Vec<Value> = request
        .messages
        .iter()
        .map(|m| {
            let role = if m.role == "assistant" { "model" } else { "user" };
            json!({ "role": role, "parts": gemini_parts(m) })
        })
        .collect();

    let mut body = json!({
        "contents": contents,
        "generationConfig": { "maxOutputTokens": request.max_tokens },
    });
    if let Some(system) = request.system.as_deref() {
        if !system.trim().is_empty() {
            body["systemInstruction"] = json!({ "parts": [{ "text": system }] });
        }
    }
    body
}

// ---- response parsing ----------------------------------------------------

/// Extracts the incremental text from a single SSE data object.
fn extract_delta(format: &str, value: &Value) -> Option<String> {
    match format {
        "anthropic" => {
            if value.get("type")?.as_str()? == "content_block_delta" {
                Some(value.get("delta")?.get("text")?.as_str()?.to_string())
            } else {
                None
            }
        }
        "gemini" => {
            let parts = value
                .get("candidates")?
                .get(0)?
                .get("content")?
                .get("parts")?
                .as_array()?;
            let text: String = parts
                .iter()
                .filter_map(|p| p.get("text").and_then(|t| t.as_str()))
                .collect();
            if text.is_empty() {
                None
            } else {
                Some(text)
            }
        }
        // openai and OpenAI-compatible providers
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
    if let Ok(value) = serde_json::from_str::<Value>(body) {
        // Most providers: { "error": { "message": "..." } }
        if let Some(msg) = value
            .get("error")
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
        {
            return msg.to_string();
        }
        // Gemini sometimes returns an array wrapper.
        if let Some(msg) = value
            .get(0)
            .and_then(|v| v.get("error"))
            .and_then(|e| e.get("message"))
            .and_then(|m| m.as_str())
        {
            return msg.to_string();
        }
    }
    if body.is_empty() {
        "request rejected".to_string()
    } else {
        body.chars().take(300).collect()
    }
}
