// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Tauri imports
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;
use std::path::PathBuf;

// Modules
mod commands;
mod models;
mod services;

// Commands
use commands::*;

// 应用状态
use commands::supplier::AppState;

/// 获取应用数据目录，优先使用用户可写目录以支持 AppImage 环境
fn get_app_data_dir() -> PathBuf {
    // 优先级1: 当前目录下的 data 文件夹（AppImage 最兼容）
    let current_dir = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
    let app_dir = current_dir.join("data");
    println!("尝试当前目录的data文件夹: {:?}", app_dir);
    if std::fs::create_dir_all(&app_dir).is_ok() {
        println!("使用当前目录的data文件夹: {:?}", app_dir);
        return app_dir;
    } else {
        println!("无法创建当前目录的data文件夹");
    }

    // 优先级2: 用户主目录下的隐藏文件夹
    if let Some(home_dir) = dirs::home_dir() {
        let app_dir = home_dir.join(".ai-tools-client");
        println!("尝试主目录路径: {:?}", app_dir);
        if std::fs::create_dir_all(&app_dir).is_ok() {
            // 测试是否可写
            let test_file = app_dir.join(".write_test");
            if std::fs::write(&test_file, "test").is_ok() {
                let _ = std::fs::remove_file(&test_file);
                println!("使用主目录路径: {:?}", app_dir);
                return app_dir;
            } else {
                println!("主目录路径不可写");
            }
        } else {
            println!("无法创建主目录路径");
        }
    }

    // 优先级3: 系统数据目录（传统方式）
    if let Some(data_dir) = dirs::data_dir() {
        let app_dir = data_dir.join("ai-tools-client");
        println!("尝试系统数据目录: {:?}", app_dir);
        if std::fs::create_dir_all(&app_dir).is_ok() {
            // 测试是否可写
            let test_file = app_dir.join(".write_test");
            if std::fs::write(&test_file, "test").is_ok() {
                let _ = std::fs::remove_file(&test_file);
                println!("使用系统数据目录: {:?}", app_dir);
                return app_dir;
            } else {
                println!("系统数据目录不可写");
            }
        } else {
            println!("无法创建系统数据目录");
        }
    }

    // 优先级4: 临时目录（最后备选）
    let temp_dir = std::env::temp_dir();
    let app_dir = temp_dir.join("ai-tools-client");
    println!("尝试临时目录: {:?}", app_dir);
    if std::fs::create_dir_all(&app_dir).is_ok() {
        println!("使用临时目录: {:?}", app_dir);
        return app_dir;
    } else {
        println!("无法创建临时目录");
    }

    // 如果都失败，使用当前目录
    println!("所有路径都失败，使用当前目录");
    PathBuf::from(".")
}

#[tokio::main]
async fn main() {
    // 初始化数据库 - 使用兼容 AppImage 的路径策略
    let app_data_dir = get_app_data_dir();

    // 确保目录存在
    std::fs::create_dir_all(&app_data_dir)
        .expect("Failed to create app data directory");

    let db_path = app_data_dir.join("ai-tools.db");
    println!("数据库文件路径: {:?}", db_path);

    // 测试文件创建权限
    println!("测试文件创建权限...");
    match std::fs::write(&db_path, "test") {
        Ok(_) => {
            println!("可以直接写入数据库文件");
            let _ = std::fs::remove_file(&db_path);
        },
        Err(e) => {
            println!("无法直接写入数据库文件: {:?}", e);
            // 尝试创建一个临时文件来测试权限
            let temp_path = app_data_dir.join("temp_test.txt");
            match std::fs::write(&temp_path, "test") {
                Ok(_) => {
                    println!("可以写入临时文件，可能是数据库文件已存在");
                    let _ = std::fs::remove_file(&temp_path);
                },
                Err(e2) => {
                    println!("无法写入任何文件: {:?}", e2);
                }
            }
        }
    }

    let db_url = format!("sqlite:{}", db_path.display());
    println!("数据库连接URL: {}", db_url);

    // 首先尝试内存数据库来测试 SQLite 库是否正常
    println!("测试内存数据库连接...");
    match services::database::Database::new("sqlite::memory:").await {
        Ok(_) => {
            println!("内存数据库连接成功，SQLite 库正常");
        },
        Err(e) => {
            println!("内存数据库连接失败: {:?}", e);
            println!("可能是 SQLite 库兼容性问题");
        }
    }

    // 尝试使用不同的数据库路径格式
    println!("尝试相对路径数据库...");
    let relative_db_url = "sqlite:./ai-tools.db";
    match services::database::Database::new(relative_db_url).await {
        Ok(_) => {
            println!("相对路径数据库连接成功！");
            // 如果相对路径成功，使用它作为数据库
            println!("使用相对路径数据库");
            let database = services::database::Database::new(relative_db_url).await.unwrap();
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
            return;
        },
        Err(e) => {
            println!("相对路径数据库连接失败: {:?}", e);
        }
    }

    // 创建数据库连接池
    let database = match services::database::Database::new(&db_url).await {
        Ok(db) => {
            println!("数据库初始化成功");
            db
        },
        Err(e) => {
            println!("数据库初始化失败: {:?}", e);
            println!("AppImage 环境下文件数据库不可用，使用内存数据库");
            println!("警告：数据将不会持久化保存");

            // 使用内存数据库作为最后的备选方案
            match services::database::Database::new("sqlite::memory:").await {
                Ok(db) => {
                    println!("内存数据库初始化成功");
                    db
                },
                Err(e2) => {
                    println!("内存数据库也失败了: {:?}", e2);
                    panic!("所有数据库选项都失败了");
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