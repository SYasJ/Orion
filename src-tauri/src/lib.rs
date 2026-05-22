mod chat;
mod providers;
mod settings;

use chat::StreamRegistry;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(StreamRegistry::default())
        .invoke_handler(tauri::generate_handler![
            chat::send_message,
            chat::cancel_stream,
            settings::get_settings,
            settings::set_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Orion");
}
