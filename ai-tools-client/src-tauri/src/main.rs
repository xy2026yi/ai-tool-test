// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Tauri imports
use tauri::Manager;

// Modules
mod commands;
mod models;
mod services;

// Commands
use commands::*;

#[tokio::main]
async fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            // Supplier commands
            commands::supplier::list_suppliers,
            commands::supplier::create_supplier,
            commands::supplier::update_supplier,
            commands::supplier::delete_supplier,
            commands::supplier::test_supplier_connection,

            // MCP Template commands
            commands::mcp_template::list_mcp_templates,
            commands::mcp_template::create_mcp_template,
            commands::mcp_template::update_mcp_template,
            commands::mcp_template::delete_mcp_template,

            // Config commands
            commands::config::backup_config,
            commands::config::update_claude_config,
            commands::config::update_codex_config,
            commands::config::restore_config,

            // Mode commands
            commands::mode::get_current_mode,
            commands::mode::switch_mode,
            commands::mode::get_mode_history,
        ])
        .setup(|app| {
            // Initialize database here
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}