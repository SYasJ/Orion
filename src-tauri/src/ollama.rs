use serde::Deserialize;

#[derive(Deserialize)]
struct TagsResponse {
    #[serde(default)]
    models: Vec<TagModel>,
}

#[derive(Deserialize)]
struct TagModel {
    name: String,
}

/// Lists the models installed in a local Ollama instance, by querying its
/// `/api/tags` endpoint. Runs in Rust to avoid webview CORS restrictions.
#[tauri::command]
pub async fn list_ollama_models(host: String) -> Result<Vec<String>, String> {
    let url = format!("{}/api/tags", host.trim_end_matches('/'));
    let response = reqwest::Client::new()
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Ollama is not reachable ({e})"))?;

    if !response.status().is_success() {
        return Err(format!("Ollama returned {}", response.status()));
    }

    let tags: TagsResponse = response
        .json()
        .await
        .map_err(|e| format!("Unexpected Ollama response: {e}"))?;

    let mut names: Vec<String> = tags.models.into_iter().map(|m| m.name).collect();
    names.sort();
    Ok(names)
}
