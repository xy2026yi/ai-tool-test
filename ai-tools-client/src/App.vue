<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { RouterView } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useThemeStore } from '@/stores/theme'
import ThemeSwitcher from '@/components/ThemeSwitcher.vue'
import HelpCenter from '@/components/HelpCenter.vue'

// 初始化应用
const appStore = useAppStore()
const themeStore = useThemeStore()

// 帮助中心对话框控制
const showHelpDialog = ref(false)

const openHelp = () => {
  showHelpDialog.value = true
}

// 监听F1键打开帮助
const handleKeyPress = (event: KeyboardEvent) => {
  if (event.key === 'F1') {
    event.preventDefault()
    openHelp()
  }
}

onMounted(() => {
  appStore.initializeApp()
  themeStore.loadTheme()
  themeStore.watchSystemTheme()
  
  // 添加快捷键监听
  window.addEventListener('keydown', handleKeyPress)
})

// 清理监听器
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyPress)
})
</script>

<template>
  <el-container class="app-container">
    <!-- 头部导航 -->
    <el-header class="app-header">
      <div class="header-content">
        <div class="logo-section">
          <h1 class="app-title">AI工具管理平台</h1>
        </div>

        <div class="nav-section">
          <el-menu mode="horizontal" :default-active="$route.path" router class="main-nav">
            <el-menu-item index="/dashboard">
              <el-icon><Monitor /></el-icon>
              <span>仪表盘</span>
            </el-menu-item>
            <el-menu-item index="/suppliers">
              <el-icon><Connection /></el-icon>
              <span>供应商管理</span>
            </el-menu-item>
            <el-menu-item index="/mcp-templates">
              <el-icon><Document /></el-icon>
              <span>MCP模板</span>
            </el-menu-item>
            <el-menu-item index="/mode-manager">
              <el-icon><Setting /></el-icon>
              <span>模式管理</span>
            </el-menu-item>
          </el-menu>
        </div>

        <div class="header-actions">
          <el-button
            text
            circle
            @click="openHelp"
            title="帮助中心 (F1)"
          >
            <el-icon :size="20"><QuestionFilled /></el-icon>
          </el-button>
          <ThemeSwitcher />
        </div>
      </div>
    </el-header>

    <!-- 主体内容 -->
    <el-main class="app-main">
      <!-- 加载状态 -->
      <div v-if="appStore.isLoading" class="loading-container">
        <el-loading-directive />
        <p>正在加载应用...</p>
      </div>

      <!-- 错误状态 -->
      <el-alert
        v-else-if="appStore.error"
        :title="appStore.error"
        type="error"
        show-icon
        :closable="false"
        class="error-alert"
      />

      <!-- 主要内容 -->
      <RouterView v-else />
    </el-main>
  </el-container>

  <!-- 帮助中心 -->
  <HelpCenter v-model:visible="showHelpDialog" />
</template>

<style scoped>
.app-container {
  height: 100vh;
  background-color: var(--el-bg-color-page);
}

.app-header {
  border-bottom: 1px solid var(--el-border-color-light);
  padding: 0;
  height: 60px;
}

.header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 100%;
  padding: 0 20px;
}

.logo-section .app-title {
  margin: 0;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.nav-section {
  flex: 1;
  margin-left: 40px;
}

.main-nav {
  border-bottom: none;
  background: transparent;
}

.main-nav .el-menu-item {
  border-bottom: 2px solid transparent;
}

.main-nav .el-menu-item.is-active {
  border-bottom-color: var(--el-color-primary);
  background: transparent;
}

.app-main {
  padding: 20px;
  overflow-y: auto;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--el-text-color-regular);
}

.error-alert {
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-left: 20px;
}
</style>
