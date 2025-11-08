import { ref, watch } from 'vue'
import { defineStore } from 'pinia'

export type ThemeMode = 'light' | 'dark' | 'auto'

export const useThemeStore = defineStore('theme', () => {
  // 状态
  const currentTheme = ref<ThemeMode>('light')
  const isDark = ref(false)

  // 从本地存储加载主题设置
  const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme') as ThemeMode | null
    if (savedTheme) {
      currentTheme.value = savedTheme
    } else {
      // 检测系统主题偏好
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      currentTheme.value = prefersDark ? 'dark' : 'light'
    }
    applyTheme()
  }

  // 应用主题
  const applyTheme = () => {
    if (currentTheme.value === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      isDark.value = prefersDark
    } else {
      isDark.value = currentTheme.value === 'dark'
    }

    // 更新HTML类名
    if (isDark.value) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  // 切换主题
  const setTheme = (theme: ThemeMode) => {
    currentTheme.value = theme
    localStorage.setItem('theme', theme)
    applyTheme()
  }

  // 监听系统主题变化
  const watchSystemTheme = () => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
    mediaQuery.addEventListener('change', (e) => {
      if (currentTheme.value === 'auto') {
        isDark.value = e.matches
        applyTheme()
      }
    })
  }

  // 切换深色/浅色模式
  const toggleDark = () => {
    if (isDark.value) {
      setTheme('light')
    } else {
      setTheme('dark')
    }
  }

  return {
    currentTheme,
    isDark,
    loadTheme,
    setTheme,
    toggleDark,
    watchSystemTheme
  }
})
