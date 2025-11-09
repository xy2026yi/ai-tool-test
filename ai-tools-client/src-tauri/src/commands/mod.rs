// 命令模块声明
pub mod config;
pub mod mcp_template;
pub mod mode;
pub mod supplier;

// 重新导出所有命令函数
pub use config::*;
pub use mcp_template::*;
pub use mode::*;
pub use supplier::*;
