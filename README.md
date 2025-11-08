# AI工具管理平台

<div align="center">

一个现代化的跨平台桌面应用，用于管理AI工具供应商、MCP服务器模板和工作模式。

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Tauri](https://img.shields.io/badge/Tauri-2.0-orange.svg)](https://tauri.app)
[![Vue.js](https://img.shields.io/badge/Vue.js-3.5-green.svg)](https://vuejs.org)

</div>

## ✨ 特性

- 🔧 **供应商管理** - 管理Claude和Codex等AI工具供应商配置
- 📦 **MCP模板管理** - 15+预定义模板，支持JSON/TOML格式
- 🔄 **工作模式切换** - Claude优先、Codex优先、混合模式一键切换
- 🔀 **智能供应商切换** - 自动故障转移，性能监控
- 📊 **实时监控** - 健康检查、响应时间、成功率统计
- 🎨 **现代化UI** - Element Plus组件库，响应式设计
- 🌗 **主题切换** - 支持浅色/深色主题
- 🌍 **国际化** - 中英文双语支持
- 💻 **跨平台** - Windows、macOS、Linux全平台支持

## 🚀 快速开始

### 环境要求

- Node.js >= 22.12.0
- Rust >= 1.70.0
- npm 或 yarn 包管理器

### 安装依赖

```bash
cd ai-tools-client
npm install
```

### 开发模式

```bash
# 启动前端开发服务器和Tauri应用
npm run tauri:dev:vite

# 或者分别启动
npm run dev        # 前端开发服务器
npm run tauri:dev  # Tauri应用
```

### 构建生产版本

```bash
# 类型检查和构建
npm run build

# 打包Tauri应用
npm run tauri:build
```

## 📚 技术栈

### 前端技术

- **框架**: Vue 3.5 + TypeScript
- **UI组件库**: Element Plus 2.11
- **状态管理**: Pinia 3.0
- **路由**: Vue Router 4.6
- **构建工具**: Vite 7.1

### 后端技术

- **应用框架**: Tauri 2.9
- **编程语言**: Rust
- **数据库**: SQLite

### 开发工具

- **代码规范**: ESLint + Prettier
- **类型检查**: TypeScript + vue-tsc
- **包管理**: npm

## 📁 项目结构

```
ai-tools-client/
├── src/                    # 前端源码
│   ├── assets/            # 静态资源
│   ├── components/        # Vue组件
│   ├── i18n/              # 国际化
│   ├── router/            # 路由配置
│   ├── services/          # API服务
│   ├── stores/            # Pinia状态管理
│   ├── types/             # TypeScript类型
│   ├── utils/             # 工具函数
│   ├── views/             # 页面组件
│   ├── App.vue            # 根组件
│   └── main.ts            # 入口文件
├── src-tauri/             # Tauri后端
│   ├── src/
│   │   ├── commands/      # Tauri命令
│   │   ├── models/        # 数据模型
│   │   ├── services/      # 后端服务
│   │   └── main.rs        # Rust入口
│   ├── Cargo.toml         # Rust依赖
│   └── tauri.conf.json    # Tauri配置
├── docs/                  # 项目文档
├── dist/                  # 构建产物
├── package.json           # 项目配置
├── vite.config.ts         # Vite配置
└── tsconfig.json          # TypeScript配置
```

## 📖 文档

- [用户手册](docs/user-guide.md) - 详细的使用指南
- [开发文档](docs/development.md) - 开发者指南和API文档
- [部署指南](docs/deployment.md) - 构建和发布流程

## 🤝 贡献

欢迎提交Issue和Pull Request！

## 📄 许可证

[MIT License](LICENSE)

## 🙏 致谢

- [Tauri](https://tauri.app) - 跨平台桌面应用框架
- [Vue.js](https://vuejs.org) - 渐进式JavaScript框架
- [Element Plus](https://element-plus.org) - Vue 3组件库
- [Vite](https://vitejs.dev) - 下一代前端构建工具
