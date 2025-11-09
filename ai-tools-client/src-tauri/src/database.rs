use sqlx::{SqlitePool, sqlite::SqliteConnectOptions, migrate::MigrateDatabase, Row};
use sqlx::sqlite::SqliteJournalMode;
use std::str::FromStr;
use anyhow::Result;
use chrono::{DateTime, Utc};

// 数据库连接池
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    /// 初始化数据库连接
    pub async fn new(database_url: &str) -> Result<Self> {
        println!("正在初始化数据库，URL: {}", database_url);

        // 对于文件数据库，先检查路径和权限
        if database_url.starts_with("sqlite:") && !database_url.contains(":memory:") {
            let path = database_url.strip_prefix("sqlite:").unwrap_or(database_url);
            println!("数据库文件路径: {}", path);

            // 确保父目录存在
            if let Some(parent) = std::path::Path::new(path).parent() {
                println!("确保数据库目录存在: {:?}", parent);
                std::fs::create_dir_all(parent)?;
            }

            // 首先尝试创建文件来测试权限
            match std::fs::File::create(path) {
                Ok(_) => {
                    println!("数据库文件创建成功，删除空文件");
                    let _ = std::fs::remove_file(path);
                },
                Err(e) => {
                    println!("无法创建数据库文件: {}", e);
                    return Err(anyhow::anyhow!("数据库文件权限不足: {}", e));
                }
            }
        }

        // 使用最简单的连接方式
        let pool = match SqlitePool::connect(database_url).await {
            Ok(pool) => {
                println!("简单数据库连接成功");
                pool
            },
            Err(e) => {
                println!("简单连接失败: {:?}", e);

                // 如果是文件数据库且简单连接失败，尝试带选项的连接
                if database_url.starts_with("sqlite:") && !database_url.contains(":memory:") {
                    println!("尝试带选项的连接...");
                    let connect_options = SqliteConnectOptions::from_str(database_url)?
                        .create_if_missing(true)
                        .journal_mode(SqliteJournalMode::Delete)
                        .busy_timeout(std::time::Duration::from_secs(10));

                    SqlitePool::connect_with(connect_options).await
                        .map_err(|e2| {
                            anyhow::anyhow!("数据库连接失败: 简单连接={}, 带选项连接={}", e, e2)
                        })?
                } else {
                    return Err(anyhow::anyhow!("数据库连接失败: {}", e));
                }
            }
        };

        println!("数据库连接成功，正在运行迁移...");

        // 运行数据库迁移
        Self::run_migrations(&pool).await
            .map_err(|e| {
                println!("数据库迁移失败: {:?}", e);
                anyhow::anyhow!("数据库迁移失败: {}", e)
            })?;

        println!("数据库初始化完成");
        Ok(Database { pool })
    }

    /// 获取数据库连接池
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    /// 运行数据库迁移
    async fn run_migrations(pool: &SqlitePool) -> Result<()> {
        // 创建供应商表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS suppliers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                type TEXT NOT NULL CHECK (type IN ('claude', 'codex')),
                name TEXT NOT NULL UNIQUE,
                base_url TEXT NOT NULL,
                auth_token TEXT NOT NULL,
                timeout_ms INTEGER DEFAULT 30000,
                auto_update INTEGER DEFAULT 0,
                opus_model TEXT,
                sonnet_model TEXT,
                haiku_model TEXT,
                is_active INTEGER DEFAULT 0,
                sort_order INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建MCP模板表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS mcp_templates (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                version TEXT DEFAULT '1.0.0',
                ai_type TEXT NOT NULL CHECK (ai_type IN ('claude', 'codex')),
                platform_type TEXT NOT NULL CHECK (platform_type IN ('unix', 'windows')),
                config_content TEXT NOT NULL,
                description TEXT,
                is_builtin INTEGER DEFAULT 0,
                category TEXT,
                tags TEXT,
                usage_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(name, version)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建配置历史表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS config_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                config_type TEXT NOT NULL,
                config_path TEXT NOT NULL,
                backup_content TEXT NOT NULL,
                operation_type TEXT NOT NULL,
                operation_time DATETIME DEFAULT CURRENT_TIMESTAMP,
                description TEXT
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建应用状态表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS app_state (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建工作模式配置表
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS work_mode_configs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                mode_name TEXT NOT NULL UNIQUE CHECK (mode_name IN ('claude_only', 'codex_only', 'claude_codex')),
                active_claude_supplier_id INTEGER,
                active_codex_supplier_id INTEGER,
                mcp_template_ids TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (active_claude_supplier_id) REFERENCES suppliers(id),
                FOREIGN KEY (active_codex_supplier_id) REFERENCES suppliers(id)
            )
            "#,
        )
        .execute(pool)
        .await?;

        // 创建索引
        sqlx::query("CREATE INDEX IF NOT EXISTS idx_suppliers_type ON suppliers(type)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_suppliers_is_active ON suppliers(is_active)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_mcp_templates_ai_type ON mcp_templates(ai_type)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_mcp_templates_platform ON mcp_templates(platform_type)")
            .execute(pool)
            .await?;

        sqlx::query("CREATE INDEX IF NOT EXISTS idx_config_history_type ON config_history(config_type)")
            .execute(pool)
            .await?;

        // 插入默认应用状态
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO app_state (key, value) VALUES
            ('current_mode', 'claude_only'),
            ('app_version', '0.1.0'),
            ('database_version', '1.0')
            "#,
        )
        .execute(pool)
        .await?;

        // 插入默认工作模式配置
        sqlx::query(
            r#"
            INSERT OR IGNORE INTO work_mode_configs (mode_name, mcp_template_ids) VALUES
            ('claude_only', '[]'),
            ('codex_only', '[]'),
            ('claude_codex', '[]')
            "#,
        )
        .execute(pool)
        .await?;

        Ok(())
    }

    /// 测试数据库连接
    pub async fn test_connection(&self) -> Result<()> {
        let result: Row = sqlx::query("SELECT 1 as test")
            .fetch_one(self.pool())
            .await?;

        let test_value: i32 = result.try_get("test")?;
        if test_value == 1 {
            Ok(())
        } else {
            Err(anyhow::anyhow!("数据库连接测试失败"))
        }
    }

    /// 获取数据库统计信息
    pub async fn get_stats(&self) -> Result<DatabaseStats> {
        let suppliers_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM suppliers")
            .fetch_one(self.pool())
            .await?;

        let templates_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mcp_templates")
            .fetch_one(self.pool())
            .await?;

        let builtin_templates: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mcp_templates WHERE is_builtin = 1")
            .fetch_one(self.pool())
            .await?;

        let custom_templates: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM mcp_templates WHERE is_builtin = 0")
            .fetch_one(self.pool())
            .await?;

        Ok(DatabaseStats {
            suppliers_count,
            templates_count,
            builtin_templates,
            custom_templates,
        })
    }
}

// 数据库统计信息
#[derive(Debug, serde::Serialize)]
pub struct DatabaseStats {
    pub suppliers_count: i64,
    pub templates_count: i64,
    pub builtin_templates: i64,
    pub custom_templates: i64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[tokio::test]
    async fn test_database_initialization() {
        let temp_dir = tempdir().unwrap();
        let db_path = temp_dir.path().join("test.db");
        let db_url = format!("sqlite:{}", db_path.display());

        let db = Database::new(&db_url).await.unwrap();
        assert!(db.test_connection().await.is_ok());

        let stats = db.get_stats().await.unwrap();
        assert_eq!(stats.suppliers_count, 0);
        assert_eq!(stats.templates_count, 0);
    }
}