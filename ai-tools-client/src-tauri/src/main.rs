// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::Mutex;
use url::Url;

// Modules
mod commands;
mod models;
mod services;

// Commands
use commands::*;

// 应用状态
use commands::supplier::AppState;

fn ensure_writable_dir(dir: &Path) -> bool {
    if let Err(err) = std::fs::create_dir_all(dir) {
        println!("无法创建目录 {:?}: {:?}", dir, err);
        return false;
    }

    let test_file = dir.join(".write_test");
    match std::fs::write(&test_file, "test") {
        Ok(_) => {
            let _ = std::fs::remove_file(&test_file);
            true
        }
        Err(err) => {
            println!("目录 {:?} 不可写: {:?}", dir, err);
            false
        }
    }
}

/// 获取应用数据目录，优先使用用户主目录下的 .ai-tools
fn get_app_data_dir() -> PathBuf {
    // 优先级1: 用户主目录
    if let Some(home_dir) = dirs::home_dir() {
        let home_dir = home_dir.join(".ai-tools");
        println!("尝试主目录路径: {:?}", home_dir);
        if ensure_writable_dir(&home_dir) {
            println!("使用主目录路径: {:?}", home_dir);
            return home_dir;
        }
    }

    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

    // 优先级2: 项目目录 data
    let data_dir = current_dir.join("data");
    println!("尝试项目 data 目录: {:?}", data_dir);
    if ensure_writable_dir(&data_dir) {
        println!("使用项目 data 目录: {:?}", data_dir);
        return data_dir;
    }

    // 优先级3: 系统数据目录
    if let Some(data_dir) = dirs::data_dir() {
        let app_dir = data_dir.join("ai-tools-client");
        println!("尝试系统数据目录: {:?}", app_dir);
        if ensure_writable_dir(&app_dir) {
            println!("使用系统数据目录: {:?}", app_dir);
            return app_dir;
        }
    }

    // 优先级4: 临时目录
    let temp_dir = std::env::temp_dir();
    let app_dir = temp_dir.join("ai-tools-client");
    println!("尝试临时目录: {:?}", app_dir);
    if ensure_writable_dir(&app_dir) {
        println!("使用临时目录: {:?}", app_dir);
        return app_dir;
    }

    // 如果都失败，使用当前目录
    println!("所有路径都失败，使用当前目录");
    PathBuf::from(".")
}

/// 根据数据库文件路径生成 sqlx 可识别的 sqlite 连接字符串
fn build_sqlite_url(db_path: &Path) -> String {
    if db_path.is_absolute() {
        if let Ok(url) = Url::from_file_path(db_path) {
            return url.as_str().replacen("file://", "sqlite://", 1);
        }
    }

    let normalized = db_path.to_string_lossy().replace('\\', "/");
    format!("sqlite://{}", normalized)
}

#[tokio::main]
async fn main() {
    // 初始化数据库 - 使用兼容 AppImage 的路径策略
    let app_data_dir = get_app_data_dir();

    let db_path = app_data_dir.join("ai-tools.db");
    println!("数据库文件路径: {:?}", db_path);

    let db_url = build_sqlite_url(&db_path);
    println!("数据库连接URL: {}", db_url);

    // 首先测试 SQLite 库是否正常工作
    println!("测试内存数据库连接...");
    match services::database::Database::new("sqlite::memory:").await {
        Ok(_) => {
            println!("内存数据库连接成功，SQLite 库正常");
        }
        Err(e) => {
            println!("内存数据库连接失败: {:?}", e);
            println!("可能是 SQLite 库兼容性问题");
        }
    }

    // 创建数据库连接池，仅使用经过验证的持久化路径
    let database = match services::database::Database::new(&db_url).await {
        Ok(db) => {
            println!("持久化数据库初始化成功: {}", db_url);
            db
        }
        Err(file_db_err) => {
            println!("持久化数据库初始化失败: {:?}", file_db_err);
            println!("使用内存数据库作为最后备选方案（数据不会持久化）");

            match services::database::Database::new("sqlite::memory:").await {
                Ok(db) => {
                    println!("内存数据库初始化成功");
                    db
                }
                Err(memory_err) => {
                    panic!(
                        "所有数据库选项都失败: 文件数据库错误={:?}, 内存数据库错误={:?}",
                        file_db_err, memory_err
                    );
                }
            }
        }
    };

    let app_state = AppState {
        db_pool: Arc::new(Mutex::new(database.pool.clone())),
    };

    tauri::Builder::default()
        .manage(app_state)
        .invoke_handler(tauri::generate_handler![
            // Supplier commands
            list_suppliers,
            create_supplier,
            update_supplier,
            delete_supplier,
            get_supplier_by_id,
            set_active_supplier,
            test_supplier_connection,
            validate_supplier_config,
            get_supplier_stats,
            import_suppliers,
            export_suppliers,
            // Supplier health check and switch commands
            check_supplier_health,
            check_all_suppliers_health,
            switch_supplier,
            auto_failover,
            get_failover_config,
            update_failover_config,
            get_supplier_switch_progress,
            // MCP Template commands
            list_mcp_templates,
            create_mcp_template,
            update_mcp_template,
            delete_mcp_template,
            get_mcp_template_by_id,
            validate_mcp_template,
            get_mcp_template_categories,
            increment_template_usage,
            clone_mcp_template,
            get_mcp_template_stats,
            import_mcp_templates,
            export_mcp_templates,
            // Config commands
            backup_config,
            get_config_history,
            get_latest_config_backup,
            restore_config_from_backup,
            cleanup_old_config_history,
            delete_config_history,
            // Work mode commands
            get_work_mode_by_name,
            list_work_mode_configs,
            update_work_mode_by_id,
            switch_work_mode,
            get_work_mode_status,
            rollback_work_mode,
            // App state commands
            get_app_state,
            set_app_state,
            get_current_mode,
            get_all_app_states,
            // Database commands
            get_database_stats,
            test_database_connection,
            export_all_data,
        ])
        .setup(|_app| {
            // 数据库已在上面初始化
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
