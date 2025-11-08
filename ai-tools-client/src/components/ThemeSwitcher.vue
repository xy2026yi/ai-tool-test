<script setup lang="ts">
import { computed } from 'vue'
import { ElSwitch, ElTooltip } from 'element-plus'
import { useThemeStore } from '@/stores/theme'
import { Moon, Sunny } from '@element-plus/icons-vue'

const themeStore = useThemeStore()

const isDark = computed(() => themeStore.isDark)

const handleThemeChange = (value: string | number | boolean) => {
  const isDarkMode = Boolean(value)
  themeStore.setTheme(isDarkMode ? 'dark' : 'light')
}
</script>

<template>
  <div class="theme-switcher">
    <el-tooltip :content="isDark ? '切换到浅色模式' : '切换到深色模式'" placement="bottom">
      <el-switch
        :model-value="isDark"
        @update:model-value="handleThemeChange"
        :active-icon="Moon"
        :inactive-icon="Sunny"
        inline-prompt
        size="large"
      />
    </el-tooltip>
  </div>
</template>

<style scoped>
.theme-switcher {
  display: flex;
  align-items: center;
}
</style>
