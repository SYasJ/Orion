mod chat;
mod providers;
mod settings;

use chat::StreamRegistry;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
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
            let handle = app.handle();

            let shortcut: Shortcut = QUICK_ASK_SHORTCUT.parse()?;
            app.global_shortcut().register(shortcut)?;

            build_tray(handle)?;
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing any window hides it to the tray; quitting is via the
            // tray menu so Orion stays resident for Quick Ask.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Orion");
}

/// Builds the system-tray icon and its menu.
fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, "open", "Open Orion", true, None::<&str>)?;
    let quick = MenuItem::with_id(app, "quick", "Quick Ask", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Orion", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &quick, &quit])?;

    let mut builder = TrayIconBuilder::new()
        .tooltip("Orion")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quick" => toggle_quick_ask(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    builder.build(app)?;
    Ok(())
}

/// Shows and focuses the main window.
fn show_main(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.unminimize();
        let _ = win.set_focus();
    }
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
