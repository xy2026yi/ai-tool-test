import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // 状态
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const currentPlatform = ref<string>('')
  const isTauriApp = ref(false)

  // 计算属性
  const isReady = computed(() => !isLoading.value && !error.value)

  // 操作
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  const setError = (errorMessage: string | null) => {
    error.value = errorMessage
  }

  const clearError = () => {
    error.value = null
  }

  const setCurrentPlatform = (platform: string) => {
    currentPlatform.value = platform
  }

  const setTauriApp = (isTauri: boolean) => {
    isTauriApp.value = isTauri
  }

  // 初始化应用
  const initializeApp = async () => {
    try {
      setLoading(true)
      clearError()

      // 检测是否在 Tauri 环境中
      if (typeof window !== 'undefined' && window.__TAURI__) {
        setTauriApp(true)

        // 获取平台信息 - 暂时使用浏览器平台信息
        setCurrentPlatform(navigator.platform)
      } else {
        setTauriApp(false)
        setCurrentPlatform(navigator.platform)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : '应用初始化失败')
    } finally {
      setLoading(false)
    }
  }

  return {
    // 状态
    isLoading,
    error,
    currentPlatform,
    isTauriApp,

    // 计算属性
    isReady,

    // 操作
    setLoading,
    setError,
    clearError,
    setCurrentPlatform,
    setTauriApp,
    initializeApp,
  }
})
