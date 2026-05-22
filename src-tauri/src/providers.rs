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

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct UsagePayload {
    id: String,
    input_tokens: u32,
    output_tokens: u32,
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
        .filter(|k| !k.is_empty());

    if request.requires_key && key.is_none() {
        return Err(format!(
            "No API key configured for '{}'. Open Settings to add one.",
            request.provider
        ));
    }

    let client = reqwest::Client::new();
    let format = request.format.as_str();

    let builder = match format {
        "anthropic" => client
            .post(&request.endpoint)
            .header("x-api-key", key.unwrap_or_default())
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
                .header("x-goog-api-key", key.unwrap_or_default())
                .header("content-type", "application/json")
                .json(&gemini_body(request))
        }
        "openai" => {
            let mut rb = client
                .post(&request.endpoint)
                .header("content-type", "application/json")
                // Recommended by OpenRouter; harmless for other OpenAI-compatible APIs.
                .header("http-referer", "https://orion.app")
                .header("x-title", "Orion")
                .json(&openai_body(request));
            // Local providers (Ollama) accept requests with no auth header.
            if let Some(k) = key {
                rb = rb.header("authorization", format!("Bearer {k}"));
            }
            rb
        }
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
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;

    'outer: while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            break 'outer;
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
                break 'outer;
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
                update_usage(format, &value, &mut input_tokens, &mut output_tokens);
            }
        }
    }

    if input_tokens > 0 || output_tokens > 0 {
        let _ = app.emit(
            "stream://usage",
            UsagePayload {
                id: stream_id.to_string(),
                input_tokens,
                output_tokens,
            },
        );
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
        "stream_options": { "include_usage": true },
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

/// Accumulates token usage from an SSE data object. Each provider reports it
/// differently; fields are overwritten as later events refine the counts.
fn update_usage(format: &str, value: &Value, input: &mut u32, output: &mut u32) {
    let read = |v: &Value, key: &str| v.get(key).and_then(|n| n.as_u64()).map(|n| n as u32);
    match format {
        "anthropic" => match value.get("type").and_then(|t| t.as_str()) {
            Some("message_start") => {
                if let Some(u) = value.get("message").and_then(|m| m.get("usage")) {
                    if let Some(n) = read(u, "input_tokens") {
                        *input = n;
                    }
                    if let Some(n) = read(u, "output_tokens") {
                        *output = n;
                    }
                }
            }
            Some("message_delta") => {
                if let Some(n) = value.get("usage").and_then(|u| read(u, "output_tokens")) {
                    *output = n;
                }
            }
            _ => {}
        },
        "gemini" => {
            if let Some(u) = value.get("usageMetadata") {
                if let Some(n) = read(u, "promptTokenCount") {
                    *input = n;
                }
                if let Some(n) = read(u, "candidatesTokenCount") {
                    *output = n;
                }
            }
        }
        // openai and OpenAI-compatible providers
        _ => {
            if let Some(u) = value.get("usage").filter(|u| u.is_object()) {
                if let Some(n) = read(u, "prompt_tokens") {
                    *input = n;
                }
                if let Some(n) = read(u, "completion_tokens") {
                    *output = n;
                }
            }
        }
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
