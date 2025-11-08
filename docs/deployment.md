# 部署指南

本文档提供 AI工具管理平台 的完整部署流程，包括构建、打包和发布步骤。

## 目录

- [构建准备](#构建准备)
- [前端构建](#前端构建)
- [Tauri 桌面应用打包](#tauri-桌面应用打包)
- [平台特定说明](#平台特定说明)
- [发布流程](#发布流程)
- [自动化部署](#自动化部署)
- [常见问题](#常见问题)

## 构建准备

### 环境要求

确保开发环境满足以下要求：

- **Node.js**: `^20.19.0` 或 `>=22.12.0`
- **Rust**: 最新稳定版（1.70+）
- **操作系统**：
  - Windows 10/11（用于构建 Windows 应用）
  - macOS 10.13+（用于构建 macOS 应用）
  - Linux（Ubuntu 20.04+ / Fedora 36+，用于构建 Linux 应用）

### 安装依赖

```bash
cd ai-tools-client
npm install
```

### 版本管理

在发布前，确保更新版本号：

**1. 更新 package.json**

```json
{
  "version": "1.0.0"
}
```

**2. 更新 src-tauri/tauri.conf.json**

```json
{
  "version": "1.0.0"
}
```

**3. 更新 src-tauri/Cargo.toml**

```toml
[package]
version = "1.0.0"
```

**推荐使用脚本统一更新**：

```bash
# 创建 scripts/bump-version.sh
#!/bin/bash
VERSION=$1

# 更新 package.json
npm version $VERSION --no-git-tag-version

# 更新 tauri.conf.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$VERSION\"/" src-tauri/tauri.conf.json

# 更新 Cargo.toml
sed -i.bak "s/version = \".*\"/version = \"$VERSION\"/" src-tauri/Cargo.toml

echo "版本已更新为 $VERSION"
```

使用方式：
```bash
chmod +x scripts/bump-version.sh
./scripts/bump-version.sh 1.0.0
```

## 前端构建

### 开发构建（用于调试）

```bash
npm run build
```

产物位于 `dist/` 目录，可通过 `npm run preview` 预览。

### 生产构建检查清单

构建前确保通过以下检查：

```bash
# 1. TypeScript 类型检查
npm run type-check

# 2. ESLint 代码检查
npm run lint

# 3. 代码格式化
npm run format

# 4. 构建
npm run build
```

### 构建优化验证

构建完成后，检查构建产物：

```bash
# 查看构建统计
ls -lh dist/assets/

# 打开可视化分析报告
open dist/stats.html  # macOS
xdg-open dist/stats.html  # Linux
start dist/stats.html  # Windows
```

**预期结果**：
- 主 JavaScript bundle：< 10KB (gzip)
- Element Plus chunk：~310KB (gzip)
- Vue vendor chunk：~40KB (gzip)
- 总体积：< 400KB (gzip)

## Tauri 桌面应用打包

### 构建命令

```bash
npm run tauri:build
```

此命令将：
1. 运行前端构建（`npm run build`）
2. 编译 Rust 后端
3. 打包成平台特定的安装包

### 构建产物位置

```
src-tauri/target/release/bundle/
├── deb/          # Linux .deb 包
├── appimage/     # Linux AppImage
├── dmg/          # macOS .dmg 安装镜像
├── macos/        # macOS .app 应用包
├── msi/          # Windows .msi 安装包
└── nsis/         # Windows NSIS 安装包
```

### 构建模式

#### 开发模式构建（带调试符号）

```bash
npm run tauri:build -- --debug
```

**用途**：本地测试和调试，包体积较大。

#### 生产模式构建（优化和压缩）

```bash
npm run tauri:build
```

**用途**：正式发布，包体积最小化。

## 平台特定说明

### Windows

#### 构建要求

- Windows 10/11
- Visual Studio Build Tools 或 Visual Studio 2019+

#### 构建步骤

```bash
npm run tauri:build
```

#### 产物

- `ai-tools-client_1.0.0_x64_en-US.msi` - MSI 安装包
- `ai-tools-client_1.0.0_x64-setup.exe` - NSIS 安装器（如果配置）

#### 签名（可选）

为 Windows 应用签名需要代码签名证书：

```bash
# 配置签名（在 tauri.conf.json 中）
{
  "bundle": {
    "windows": {
      "certificateThumbprint": "<证书指纹>",
      "timestampUrl": "http://timestamp.digicert.com"
    }
  }
}
```

#### 安装测试

```bash
# 运行 MSI 安装包
start src-tauri/target/release/bundle/msi/ai-tools-client_1.0.0_x64_en-US.msi
```

### macOS

#### 构建要求

- macOS 10.13+
- Xcode Command Line Tools

#### 构建步骤

```bash
npm run tauri:build
```

#### 产物

- `ai-tools-client.app` - macOS 应用包
- `ai-tools-client_1.0.0_x64.dmg` - DMG 安装镜像

#### 签名和公证（App Store 发布必需）

**1. 配置代码签名**

```json
{
  "bundle": {
    "macOS": {
      "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)"
    }
  }
}
```

**2. 签名应用**

```bash
codesign --deep --force --verify --verbose \
  --sign "Developer ID Application: Your Name" \
  src-tauri/target/release/bundle/macos/ai-tools-client.app
```

**3. 公证（Notarization）**

```bash
# 创建 DMG
hdiutil create -volname "AI工具管理平台" -srcfolder \
  src-tauri/target/release/bundle/macos/ai-tools-client.app \
  -ov -format UDZO ai-tools-client.dmg

# 提交公证
xcrun notarytool submit ai-tools-client.dmg \
  --apple-id "your@email.com" \
  --team-id "TEAM_ID" \
  --password "app-specific-password" \
  --wait

# 装订公证票据
xcrun stapler staple ai-tools-client.dmg
```

#### 安装测试

```bash
# 打开 DMG
open src-tauri/target/release/bundle/dmg/ai-tools-client_1.0.0_x64.dmg

# 或直接运行应用
open src-tauri/target/release/bundle/macos/ai-tools-client.app
```

### Linux

#### 构建要求

Ubuntu 20.04+ / Fedora 36+ 或其他现代发行版。

**安装系统依赖**：

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Fedora
sudo dnf install \
  webkit2gtk4.0-devel \
  openssl-devel \
  curl \
  wget \
  libappindicator-gtk3 \
  librsvg2-devel

# Arch Linux
sudo pacman -S \
  webkit2gtk \
  base-devel \
  curl \
  wget \
  openssl \
  appmenu-gtk-module \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

#### 构建步骤

```bash
npm run tauri:build
```

#### 产物

- `ai-tools-client_1.0.0_amd64.deb` - Debian/Ubuntu 包
- `ai-tools-client_1.0.0_amd64.AppImage` - 通用 AppImage

#### 安装测试

**DEB 包**：
```bash
sudo dpkg -i src-tauri/target/release/bundle/deb/ai-tools-client_1.0.0_amd64.deb
```

**AppImage**：
```bash
chmod +x src-tauri/target/release/bundle/appimage/ai-tools-client_1.0.0_amd64.AppImage
./src-tauri/target/release/bundle/appimage/ai-tools-client_1.0.0_amd64.AppImage
```

## 发布流程

### 手动发布

#### 1. 准备发布

```bash
# 检查代码质量
npm run type-check
npm run lint

# 运行测试（如果有）
npm test

# 更新版本号
./scripts/bump-version.sh 1.0.0

# 更新 CHANGELOG
# 编辑 CHANGELOG.md，添加新版本变更记录
```

#### 2. 构建所有平台

```bash
# 在各自平台上执行
npm run tauri:build
```

#### 3. 创建 Git 标签

```bash
git add .
git commit -m "chore: release v1.0.0"
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin master
git push origin v1.0.0
```

#### 4. 创建 GitHub Release

1. 访问 GitHub 仓库的 Releases 页面
2. 点击 "Draft a new release"
3. 选择刚创建的标签 `v1.0.0`
4. 填写 Release 标题和说明（从 CHANGELOG 复制）
5. 上传构建产物：
   - Windows: `.msi` 文件
   - macOS: `.dmg` 文件
   - Linux: `.deb` 和 `.AppImage` 文件
6. 发布 Release

### 自动发布（GitHub Actions）

#### 创建 GitHub Actions 工作流

**文件位置**：`.github/workflows/release.yml`

```yaml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        platform: [macos-latest, ubuntu-20.04, windows-latest]

    runs-on: ${{ matrix.platform }}

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-20.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.0-dev \
            build-essential curl wget libssl-dev libgtk-3-dev \
            libayatana-appindicator3-dev librsvg2-dev

      - name: Install frontend dependencies
        run: |
          cd ai-tools-client
          npm install

      - name: Build Tauri app
        run: |
          cd ai-tools-client
          npm run tauri:build

      - name: Upload artifacts
        uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.platform }}-build
          path: |
            ai-tools-client/src-tauri/target/release/bundle/

      - name: Create Release
        uses: softprops/action-gh-release@v1
        if: startsWith(github.ref, 'refs/tags/')
        with:
          files: |
            ai-tools-client/src-tauri/target/release/bundle/**/*.msi
            ai-tools-client/src-tauri/target/release/bundle/**/*.dmg
            ai-tools-client/src-tauri/target/release/bundle/**/*.deb
            ai-tools-client/src-tauri/target/release/bundle/**/*.AppImage
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

#### 触发自动发布

```bash
# 创建并推送标签
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions 将自动：
1. 在 Windows、macOS、Linux 上并行构建
2. 创建 GitHub Release
3. 上传构建产物

## 自动化部署

### 持续集成（CI）

**文件位置**：`.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [master]
  pull_request:
    branches: [master]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: |
          cd ai-tools-client
          npm install

      - name: Type check
        run: |
          cd ai-tools-client
          npm run type-check

      - name: Lint
        run: |
          cd ai-tools-client
          npm run lint

      - name: Build
        run: |
          cd ai-tools-client
          npm run build
```

### 自动更新机制

Tauri 支持内置的自动更新功能。

#### 配置自动更新

**1. 在 tauri.conf.json 中启用**

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://your-server.com/updates/{{target}}/{{current_version}}"
      ],
      "dialog": true,
      "pubkey": "YOUR_PUBLIC_KEY"
    }
  }
}
```

#### 2. 生成更新密钥

```bash
npm run tauri signer generate
```

保存输出的公钥和私钥。

#### 3. 前端集成更新逻辑

```typescript
import { checkUpdate, installUpdate } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

async function checkForUpdates() {
  const update = await checkUpdate()
  if (update?.available) {
    console.log(`发现新版本 ${update.version}`)
    await update.downloadAndInstall()
    await relaunch()
  }
}
```

## 常见问题

### 构建问题

**Q: Windows 构建失败，提示 "VCRUNTIME140.dll 未找到"**

A: 安装 Visual C++ Redistributable：
https://aka.ms/vs/17/release/vc_redist.x64.exe

**Q: macOS 构建失败，提示 "xcrun: error"**

A: 安装或更新 Xcode Command Line Tools：
```bash
xcode-select --install
```

**Q: Linux 构建失败，提示缺少库**

A: 参考 [Linux 构建要求](#linux)，安装所有系统依赖。

### 性能问题

**Q: 构建后的应用启动很慢**

A: 检查以下几点：
- 是否使用 `--release` 模式构建
- 是否禁用了 sourcemap（生产环境）
- 数据库初始化是否异步进行

**Q: 包体积过大**

A: 执行以下优化：
- 检查是否包含了 sourcemap（应禁用）
- 分析 `dist/stats.html`，排查大体积依赖
- 确认 Tauri 使用了 `minify: true`

### 部署问题

**Q: 用户安装后无法启动**

A: 常见原因：
- Windows: 缺少 WebView2 Runtime（Tauri 会自动下载）
- macOS: 应用未签名或公证（绕过：右键 → 打开）
- Linux: 缺少系统依赖（提供依赖列表）

**Q: 自动更新不工作**

A: 检查：
- 更新服务器是否可访问
- 公钥是否正确配置
- 更新清单格式是否正确

### 测试和验证

**Q: 如何在发布前验证安装包？**

A: 建议流程：
1. 在虚拟机或测试机器上安装
2. 检查应用是否正常启动
3. 测试核心功能（供应商管理、模式切换等）
4. 检查数据库创建和读写
5. 验证配置文件导入导出

## 清单总结

### 发布前检查清单

- [ ] 代码通过 `npm run type-check`
- [ ] 代码通过 `npm run lint`
- [ ] 版本号已更新（package.json, tauri.conf.json, Cargo.toml）
- [ ] CHANGELOG.md 已更新
- [ ] 构建产物在各平台测试通过
- [ ] Git 标签已创建并推送
- [ ] GitHub Release 已创建
- [ ] 安装包已上传到 Release
- [ ] Release 说明清晰完整

### 质量保证清单

- [ ] 应用启动正常
- [ ] 所有核心功能可用
- [ ] 数据库操作正常
- [ ] 配置导入导出正常
- [ ] 供应商切换和健康检查正常
- [ ] 主题切换和国际化正常
- [ ] 无明显性能问题
- [ ] 无内存泄漏
- [ ] 错误处理正确

## 获取帮助

如遇到部署问题，请：
1. 查阅 [Tauri 官方文档](https://tauri.app/v1/guides/building/)
2. 搜索 [GitHub Issues](https://github.com/tauri-apps/tauri/issues)
3. 联系项目维护团队

---

**祝发布顺利！** 有任何问题或建议，欢迎提交 Issue。
