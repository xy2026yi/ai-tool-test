# 开发者文档

本文档面向希望参与 AI工具管理平台 开发的开发者，涵盖环境配置、项目架构、开发规范和贡献指南。

## 目录

- [环境要求](#环境要求)
- [快速开始](#快速开始)
- [项目架构](#项目架构)
- [开发规范](#开发规范)
- [API文档](#api文档)
- [测试指南](#测试指南)
- [构建和发布](#构建和发布)
- [贡献指南](#贡献指南)

## 环境要求

### 必需软件

1. **Node.js**
   - 版本：`^20.19.0` 或 `>=22.12.0`
   - 推荐使用 nvm 管理 Node 版本
   - 下载：https://nodejs.org/

2. **Rust**
   - 版本：Latest stable
   - 工具链：`rustc` + `cargo`
   - 下载：https://www.rust-lang.org/tools/install

3. **系统依赖**
   - **Windows**：无额外依赖
   - **macOS**：Xcode Command Line Tools
   - **Linux**：`build-essential`, `libwebkit2gtk-4.0-dev`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`

### 开发工具推荐

- **IDE**：VS Code + Volar + rust-analyzer
- **Git**：版本管理工具
- **浏览器**：Chrome/Edge（用于调试）

## 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd ai-tools
```

### 2. 安装前端依赖

```bash
cd ai-tools-client
npm install
```

### 3. 启动开发服务器

#### 方式一：仅前端开发（推荐用于 UI 调试）

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`

#### 方式二：Tauri 完整开发模式

```bash
npm run tauri:dev
```

这将同时启动 Vite 开发服务器和 Tauri 桌面应用。

### 4. 代码检查

```bash
# TypeScript 类型检查
npm run type-check

# ESLint 检查和自动修复
npm run lint

# Prettier 格式化
npm run format
```

## 项目架构

### 技术栈

#### 前端层
- **框架**：Vue 3 (Composition API)
- **类型系统**：TypeScript 5.9
- **构建工具**：Vite 7
- **UI 库**：Element Plus 2.11
- **状态管理**：Pinia 3.0
- **路由**：Vue Router 4.6
- **国际化**：自定义轻量级 i18n 系统

#### 后端层 (Tauri)
- **语言**：Rust 2021 Edition
- **框架**：Tauri 2.0
- **数据库**：SQLite (via SQLx)
- **异步运行时**：Tokio
- **序列化**：Serde + serde_json
- **错误处理**：anyhow + thiserror

### 目录结构

```
ai-tools-client/
├── src/                    # 前端源码
│   ├── assets/            # 静态资源
│   │   ├── main.css       # 主样式
│   │   ├── responsive.css # 响应式样式
│   │   └── theme.css      # 主题样式
│   ├── components/        # Vue 组件
│   │   ├── HelpCenter.vue         # 帮助中心
│   │   ├── MonitoringDashboard.vue # 监控仪表盘
│   │   └── ThemeSwitcher.vue      # 主题切换器
│   ├── i18n/             # 国际化
│   │   ├── index.ts              # i18n 核心
│   │   └── locales/              # 语言包
│   │       ├── zh-CN.ts
│   │       └── en-US.ts
│   ├── router/           # 路由配置
│   │   └── index.ts
│   ├── services/         # API 服务层
│   │   ├── supplierApi.ts        # 供应商 API
│   │   └── ...
│   ├── stores/           # Pinia 状态管理
│   │   ├── supplierSwitch.ts     # 供应商切换状态
│   │   ├── theme.ts              # 主题状态
│   │   └── ...
│   ├── types/            # TypeScript 类型定义
│   │   ├── supplier.ts
│   │   └── ...
│   ├── views/            # 页面组件
│   │   ├── Dashboard.vue
│   │   ├── Suppliers.vue
│   │   ├── McpTemplates.vue
│   │   ├── ModeManager.vue
│   │   ├── SupplierSwitcher.vue
│   │   └── ConfigManager.vue
│   ├── App.vue           # 根组件
│   └── main.ts           # 应用入口
├── src-tauri/            # Tauri Rust 后端
│   ├── src/
│   │   ├── commands/     # Tauri 命令模块
│   │   │   ├── mod.rs
│   │   │   ├── supplier.rs       # 供应商命令
│   │   │   ├── mcp_template.rs   # MCP 模板命令
│   │   │   ├── config.rs         # 配置命令
│   │   │   ├── work_mode.rs      # 工作模式命令
│   │   │   └── database.rs       # 数据库命令
│   │   ├── models/       # 数据模型
│   │   ├── services/     # 业务服务层
│   │   │   └── database.rs
│   │   └── main.rs       # Rust 应用入口
│   ├── Cargo.toml        # Rust 依赖配置
│   ├── tauri.conf.json   # Tauri 配置文件
│   └── icons/            # 应用图标
├── dist/                 # 构建产物
├── package.json          # Node 依赖配置
├── vite.config.ts        # Vite 配置
├── tsconfig.json         # TypeScript 配置
└── README.md             # 项目说明
```

### 模块设计

#### 1. 供应商管理模块
- **前端**：`views/Suppliers.vue` + `services/supplierApi.ts` + `stores/supplierSwitch.ts`
- **后端**：`commands/supplier.rs`
- **功能**：CRUD 操作、连接测试、配置验证、导入导出

#### 2. MCP 模板管理模块
- **前端**：`views/McpTemplates.vue` + 对应 API 服务
- **后端**：`commands/mcp_template.rs`
- **功能**：模板管理、分类管理、使用统计、克隆功能

#### 3. 工作模式管理模块
- **前端**：`views/ModeManager.vue`
- **后端**：`commands/work_mode.rs`
- **功能**：模式切换、配置更新、状态追踪、回滚功能

#### 4. 供应商切换模块
- **前端**：`views/SupplierSwitcher.vue` + `components/MonitoringDashboard.vue`
- **后端**：`commands/supplier.rs` (健康检查、故障转移)
- **功能**：手动切换、自动故障转移、健康监控、性能指标

#### 5. 配置管理模块
- **前端**：`views/ConfigManager.vue`
- **后端**：`commands/config.rs`
- **功能**：备份管理、版本历史、恢复功能、清理机制

#### 6. 主题和国际化模块
- **前端**：`stores/theme.ts` + `i18n/index.ts` + `components/ThemeSwitcher.vue`
- **功能**：浅色/深色/自动主题、中英文切换、响应式布局

## 开发规范

### 代码风格

#### TypeScript/Vue
- **缩进**：2 空格
- **引号**：单引号
- **分号**：无分号风格（由 Prettier 管理）
- **命名约定**：
  - 组件：PascalCase (`HelpCenter.vue`)
  - 文件：kebab-case (`supplier-api.ts`)
  - 变量/函数：camelCase (`getUserData`)
  - 常量：UPPER_SNAKE_CASE (`MAX_RETRIES`)
  - 类型/接口：PascalCase (`SupplierConfig`)

#### Rust
- **缩进**：4 空格
- **命名约定**：遵循 Rust 标准 (snake_case 函数, PascalCase 类型)
- **格式化**：使用 `cargo fmt`
- **Lint**：使用 `cargo clippy`

### Git 提交规范

使用约定式提交（Conventional Commits）：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型（type）**：
- `feat`: 新功能
- `fix`: 修复 bug
- `docs`: 文档更新
- `style`: 代码格式调整（不影响功能）
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试相关
- `chore`: 构建/工具链相关

**示例**：
```
feat(supplier): 添加供应商健康检查功能

- 实现定时健康检查任务
- 添加健康状态指标收集
- 支持自定义检查间隔

Closes #123
```

### 组件开发规范

#### Vue 组件结构

```vue
<script setup lang="ts">
// 1. 导入依赖
import { ref, computed, onMounted } from 'vue'
import type { ComponentType } from '@/types'

// 2. 定义 props 和 emits
const props = defineProps<{
  modelValue: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

// 3. 响应式状态
const localValue = ref('')

// 4. 计算属性
const displayValue = computed(() => localValue.value.toUpperCase())

// 5. 方法
const handleChange = () => {
  emit('update:modelValue', localValue.value)
}

// 6. 生命周期
onMounted(() => {
  localValue.value = props.modelValue
})
</script>

<template>
  <!-- 模板内容 -->
</template>

<style scoped>
/* 组件样式 */
</style>
```

#### Tauri 命令规范

```rust
use tauri::State;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct MyRequest {
    pub field: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct MyResponse {
    pub success: bool,
    pub data: Option<String>,
}

#[tauri::command]
pub async fn my_command(
    request: MyRequest,
    state: State<'_, AppState>,
) -> Result<MyResponse, String> {
    // 实现逻辑
    Ok(MyResponse {
        success: true,
        data: Some(request.field),
    })
}
```

### 状态管理规范

使用 Pinia 时，推荐使用 Composition API 风格：

```typescript
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useMyStore = defineStore('myStore', () => {
  // 状态
  const count = ref(0)

  // 计算属性
  const doubleCount = computed(() => count.value * 2)

  // 方法
  const increment = () => {
    count.value++
  }

  return { count, doubleCount, increment }
})
```

### 错误处理规范

#### 前端错误处理

```typescript
import { ElMessage } from 'element-plus'

try {
  const result = await supplierApi.createSupplier(data)
  ElMessage.success('创建成功')
  return result
} catch (error) {
  console.error('创建供应商失败:', error)
  ElMessage.error(error instanceof Error ? error.message : '创建失败')
  throw error
}
```

#### 后端错误处理

```rust
use anyhow::{Context, Result};

#[tauri::command]
pub async fn risky_operation() -> Result<String, String> {
    let result = perform_operation()
        .context("操作失败")
        .map_err(|e| e.to_string())?;

    Ok(result)
}
```

## API 文档

### Tauri 命令接口

所有 Tauri 命令通过前端 `window.__TAURI__.invoke()` 调用。

#### 供应商管理 API

```typescript
// 获取供应商列表
invoke<Supplier[]>('list_suppliers')

// 创建供应商
invoke<Supplier>('create_supplier', { supplier: CreateSupplierRequest })

// 更新供应商
invoke<Supplier>('update_supplier', { id: string, supplier: UpdateSupplierRequest })

// 删除供应商
invoke<void>('delete_supplier', { id: string })

// 测试连接
invoke<TestConnectionResponse>('test_supplier_connection', { id: string })

// 设置活跃供应商
invoke<void>('set_active_supplier', { id: string })
```

#### 健康检查和切换 API

```typescript
// 检查单个供应商健康
invoke<HealthCheckResult>('check_supplier_health', { id: string })

// 检查所有供应商健康
invoke<HealthCheckResult[]>('check_all_suppliers_health')

// 手动切换供应商
invoke<SwitchResult>('switch_supplier', { targetId: string })

// 自动故障转移
invoke<FailoverResult>('auto_failover', { failedId: string })

// 获取故障转移配置
invoke<FailoverConfig>('get_failover_config')

// 更新故障转移配置
invoke<void>('update_failover_config', { config: FailoverConfig })
```

#### MCP 模板 API

```typescript
// 获取模板列表
invoke<McpTemplate[]>('list_mcp_templates', { category?: string })

// 创建模板
invoke<McpTemplate>('create_mcp_template', { template: CreateTemplateRequest })

// 克隆模板
invoke<McpTemplate>('clone_mcp_template', { id: string, newName: string })

// 验证模板
invoke<ValidationResult>('validate_mcp_template', { template: McpTemplate })
```

#### 工作模式 API

```typescript
// 切换工作模式
invoke<SwitchModeResult>('switch_work_mode', { modeName: string })

// 获取模式状态
invoke<WorkModeStatus>('get_work_mode_status')

// 回滚工作模式
invoke<void>('rollback_work_mode')
```

#### 配置管理 API

```typescript
// 备份配置
invoke<BackupResult>('backup_config', { description?: string })

// 获取备份历史
invoke<ConfigBackup[]>('get_config_history')

// 恢复配置
invoke<void>('restore_config_from_backup', { backupId: string })

// 清理旧备份
invoke<number>('cleanup_old_config_history', { keepDays: number })
```

### 数据模型定义

详细类型定义请参考 `src/types/` 目录下的 TypeScript 定义文件。

## 测试指南

### 前端测试

（待补充：建议使用 Vitest + Vue Test Utils）

### 后端测试

```bash
cd src-tauri
cargo test
```

### 集成测试

1. 启动开发环境：`npm run tauri:dev`
2. 手动测试各模块功能
3. 验证数据库操作正确性
4. 检查错误处理和边界条件

## 构建和发布

### 开发构建

```bash
# 构建前端
npm run build

# 类型检查
npm run type-check
```

### 生产构建

```bash
# 构建 Tauri 桌面应用
npm run tauri:build
```

构建产物位于 `src-tauri/target/release/bundle/` 目录下：
- **Windows**：`.msi` 安装包
- **macOS**：`.dmg` / `.app` 应用包
- **Linux**：`.deb` / `.AppImage` 安装包

### 性能优化

项目已配置以下优化：
- ✅ 代码分割（Element Plus 和 Vue 核心独立打包）
- ✅ 路由懒加载
- ✅ Terser 压缩
- ✅ Tree-shaking（自动移除未使用代码）
- ✅ 禁用 sourcemap（生产环境）

构建后可查看 `dist/stats.html` 分析包大小。

### 发布检查清单

- [ ] 代码通过 `npm run type-check`
- [ ] 代码通过 `npm run lint`
- [ ] 所有功能手动测试通过
- [ ] 更新 `CHANGELOG.md`
- [ ] 更新版本号（`package.json` 和 `tauri.conf.json`）
- [ ] 创建 Git 标签：`git tag v1.0.0`
- [ ] 执行 `npm run tauri:build`
- [ ] 测试构建产物在目标平台正常运行

## 贡献指南

### 参与开发

1. **Fork 项目**到自己的 GitHub 账号
2. **克隆 Fork**：`git clone <your-fork-url>`
3. **创建特性分支**：`git checkout -b feature/my-feature`
4. **提交变更**：遵循[提交规范](#git-提交规范)
5. **推送分支**：`git push origin feature/my-feature`
6. **发起 Pull Request**

### Pull Request 要求

- 提供清晰的描述说明变更内容和原因
- 代码通过类型检查和 Lint 检查
- 新功能需补充对应文档
- 保持提交历史整洁（使用 rebase）

### 代码审查

所有 PR 需要至少一位维护者审查通过后方可合并。审查关注：
- 代码质量和可读性
- 是否符合项目规范
- 是否引入新的依赖（需要充分理由）
- 性能影响
- 安全性考虑

### 问题反馈

使用 GitHub Issues 报告 Bug 或提出功能建议，请提供：
- 问题描述
- 复现步骤
- 预期行为
- 实际行为
- 环境信息（操作系统、Node 版本、Rust 版本）

## 常见问题

### 开发环境问题

**Q: Tauri 编译失败，提示缺少系统依赖**

A: 参考[环境要求](#环境要求)章节，安装对应平台的系统依赖。

**Q: npm install 失败**

A: 检查 Node 版本是否符合要求（^20.19.0 或 >=22.12.0），使用 nvm 切换版本。

**Q: 类型检查报错但实际运行正常**

A: 运行 `npm run type-check` 查看详细错误信息，可能是 TypeScript 配置问题。

### 调试技巧

**前端调试**：
- 使用浏览器开发者工具（F12）
- 安装 Vue DevTools 扩展
- 检查 Network 面板查看 Tauri 命令调用

**后端调试**：
- 查看终端 Rust 日志输出
- 在 Rust 代码中添加 `println!` 或使用 `dbg!` 宏
- 使用 `RUST_LOG=debug npm run tauri:dev` 启用详细日志

**数据库调试**：
- 数据库文件位置：`<用户数据目录>/ai-tools-client/ai-tools.db`
- 使用 SQLite 客户端（如 DB Browser for SQLite）查看数据
- 检查 SQL 查询和事务日志

## 相关资源

- [Vue 3 文档](https://cn.vuejs.org/)
- [Tauri 文档](https://tauri.app/)
- [Element Plus 文档](https://element-plus.org/)
- [Pinia 文档](https://pinia.vuejs.org/)
- [Rust 文档](https://www.rust-lang.org/zh-CN/learn)
- [SQLx 文档](https://github.com/launchbadge/sqlx)

## 获取帮助

- 查阅[用户指南](./user-guide.md)
- 查看项目 [Issues](https://github.com/<your-org>/<repo>/issues)
- 联系维护团队

---

**祝开发愉快！** 如有任何问题或建议，欢迎提交 Issue 或 PR。
