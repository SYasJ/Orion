mod chat;
mod providers;
mod settings;

use chat::StreamRegistry;
use tauri::{AppHandle, Manager, WindowEvent};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

/// Global hotkey that summons the Quick Ask overlay.
const QUICK_ASK_SHORTCUT: &str = "CmdOrCtrl+Shift+Space";

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, _shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        toggle_quick_ask(app);
                    }
                })
                .build(),
        )
        .manage(StreamRegistry::default())
        .invoke_handler(tauri::generate_handler![
            chat::send_message,
            chat::cancel_stream,
            settings::get_settings,
            settings::set_settings,
        ])
        .setup(|app| {
            let shortcut: Shortcut = QUICK_ASK_SHORTCUT.parse()?;
            app.global_shortcut().register(shortcut)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                match window.label() {
                    // Closing the main window quits Orion.
                    "main" => window.app_handle().exit(0),
                    // Quick Ask hides instead of closing, so it can be re-summoned.
                    "quickask" => {
                        api.prevent_close();
                        let _ = window.hide();
                    }
                    _ => {}
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Orion");
}

/// Shows or hides the always-ready Quick Ask window.
fn toggle_quick_ask(app: &AppHandle) {
    let Some(win) = app.get_webview_window("quickask") else {
        return;
    };
    if win.is_visible().unwrap_or(false) {
        let _ = win.hide();
    } else {
        let _ = win.center();
        let _ = win.show();
        let _ = win.set_focus();
    }
}
