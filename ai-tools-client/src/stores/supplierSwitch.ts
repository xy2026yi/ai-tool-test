import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type {
  Supplier,
  SupplierHealth,
  SupplierSwitchProgress,
  SupplierSwitchRequest,
  SupplierSwitchResult,
  SupplierSwitchHistory,
  FailoverConfig,
  SupplierPerformanceMetrics
} from '@/types'
import { supplierApi } from '@/services/supplierApi'

export const useSupplierSwitchStore = defineStore('supplierSwitch', () => {
  // 状态
  const suppliers = ref<Supplier[]>([])
  const healthStatus = ref<Map<number, SupplierHealth>>(new Map())
  const isSwitching = ref(false)
  const switchProgress = ref<SupplierSwitchProgress | null>(null)
  const switchHistory = ref<SupplierSwitchHistory[]>([])
  const failoverConfigs = ref<Map<string, FailoverConfig>>(new Map())
  const performanceMetrics = ref<Map<number, SupplierPerformanceMetrics>>(new Map())
  const notifications = ref<Array<{
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: string
    read: boolean
  }>>([])

  // 设置
  const settings = ref({
    autoHealthCheck: true,
    healthCheckInterval: 30000, // 30秒
    enableAutoFailover: true,
    showNotifications: true,
    requireConfirmationForManualSwitch: true,
    maxHistoryRecords: 50,
    performanceMonitoringEnabled: true
  })

  // 计算属性
  const claudeSuppliers = computed(() =>
    suppliers.value.filter(s => s.type === 'claude')
  )

  const codexSuppliers = computed(() =>
    suppliers.value.filter(s => s.type === 'codex')
  )

  const activeClaudeSupplier = computed(() =>
    suppliers.value.find(s => s.type === 'claude' && s.isActive)
  )

  const activeCodexSupplier = computed(() =>
    suppliers.value.find(s => s.type === 'codex' && s.isActive)
  )

  const healthySuppliers = computed(() =>
    suppliers.value.filter(s => {
      const health = healthStatus.value.get(s.id!)
      return health?.isHealthy
    })
  )

  const unhealthySuppliers = computed(() =>
    suppliers.value.filter(s => {
      const health = healthStatus.value.get(s.id!)
      return health && !health.isHealthy
    })
  )

  const suppliersByType = computed(() => {
    return {
      claude: claudeSuppliers.value,
      codex: codexSuppliers.value
    }
  })

  const healthSummaryByType = computed(() => {
    const summary: Record<string, { healthy: number; total: number; percentage: number }> = {}

    const supplierTypes: Array<'claude' | 'codex'> = ['claude', 'codex']
    supplierTypes.forEach(type => {
      const typeSuppliers = suppliers.value.filter(s => s.type === type)
      const healthyTypeSuppliers = typeSuppliers.filter(s => {
        const health = healthStatus.value.get(s.id!)
        return health?.isHealthy
      })

      summary[type] = {
        healthy: healthyTypeSuppliers.length,
        total: typeSuppliers.length,
        percentage: typeSuppliers.length > 0 ? (healthyTypeSuppliers.length / typeSuppliers.length) * 100 : 0
      }
    })

    return summary
  })

  const isReadyForSwitch = computed(() =>
    !isSwitching.value && healthySuppliers.value.length > 0
  )

  const unreadNotifications = computed(() =>
    notifications.value.filter(n => !n.read)
  )

  const recentHistory = computed(() =>
    switchHistory.value.slice(0, 10)
  )

  const averageResponseTimeByType = computed(() => {
    const avgTimes: Record<string, number> = {}

    const supplierTypes: Array<'claude' | 'codex'> = ['claude', 'codex']
    supplierTypes.forEach(type => {
      const typeSuppliers = suppliers.value.filter(s => s.type === type)
      const validTimes = typeSuppliers
        .map(s => healthStatus.value.get(s.id!)?.responseTime)
        .filter(time => time !== undefined && time > 0) as number[]

      if (validTimes.length > 0) {
        avgTimes[type] = validTimes.reduce((sum, time) => sum + time, 0) / validTimes.length
      } else {
        avgTimes[type] = 0
      }
    })

    return avgTimes
  })

  // 加载相关操作
  const loadSuppliers = async () => {
    try {
      const sups = await supplierApi.listSuppliers()
      suppliers.value = sups
      return sups
    } catch (error) {
      console.error('加载供应商列表失败:', error)
      addNotification({
        id: `load-suppliers-error-${Date.now()}`,
        type: 'error',
        title: '加载失败',
        message: '无法加载供应商列表',
        timestamp: new Date().toISOString(),
        read: false
      })
      throw error
    }
  }

  const loadHealthStatus = async (supplierId?: number) => {
    try {
      if (supplierId) {
        const health = await supplierApi.checkSupplierHealth(supplierId)
        healthStatus.value.set(supplierId, health)
        return health
      } else {
        const healthResults = await supplierApi.checkAllSuppliersHealth()
        healthResults.forEach(health => {
          healthStatus.value.set(health.supplierId, health)
        })
        return healthResults
      }
    } catch (error) {
      console.error('加载健康状态失败:', error)
      throw error
    }
  }

  const loadFailoverConfig = async (supplierType: string) => {
    try {
      const config = await supplierApi.getFailoverConfig(supplierType)
      failoverConfigs.value.set(supplierType, config)
      return config
    } catch (error) {
      console.error('加载故障转移配置失败:', error)
      throw error
    }
  }

  const loadSwitchHistory = async () => {
    try {
      const history = await supplierApi.getSupplierSwitchHistory(settings.value.maxHistoryRecords)
      switchHistory.value = history
      return history
    } catch (error) {
      console.error('加载切换历史失败:', error)
      throw error
    }
  }

  const loadPerformanceMetrics = async (supplierId: number) => {
    try {
      const metrics = await supplierApi.getSupplierPerformanceMetrics(supplierId)
      performanceMetrics.value.set(supplierId, metrics)
      return metrics
    } catch (error) {
      console.error('加载性能指标失败:', error)
      throw error
    }
  }

  const loadAllData = async () => {
    try {
      await Promise.all([
        loadSuppliers(),
        loadHealthStatus(),
        loadSwitchHistory(),
        loadFailoverConfig('claude'),
        loadFailoverConfig('codex')
      ])

      // 加载性能指标
      for (const supplier of suppliers.value) {
        if (supplier.id) {
          await loadPerformanceMetrics(supplier.id)
        }
      }
    } catch (error) {
      console.error('加载供应商切换数据失败:', error)
      throw error
    }
  }

  // 供应商切换操作
  const switchSupplier = async (request: SupplierSwitchRequest) => {
    try {
      // 验证切换请求
      const validation = supplierApi.validateSwitchRequest(request)
      if (!validation.valid) {
        throw new Error(`切换请求验证失败: ${validation.errors.join(', ')}`)
      }

      // 检查切换条件
      const canSwitch = await supplierApi.canSwitchSupplier(request.fromSupplierId, request.toSupplierId)
      if (!canSwitch.canSwitch) {
        throw new Error(`切换条件不满足: ${canSwitch.reasons.join(', ')}`)
      }

      isSwitching.value = true

      // 记录切换开始时间
      const startTime = new Date().toISOString()

      // 初始化进度
      switchProgress.value = {
        totalSteps: 4,
        completedSteps: 0,
        overallProgress: 0,
        currentStep: '准备切换',
        fromSupplier: request.fromSupplierId,
        toSupplier: request.toSupplierId,
        startTime,
        rollbackAvailable: false,
        isCompleted: false,
        hasError: false
      }

      // 执行切换
      const result = await supplierApi.switchSupplier(request)

      if (result.success) {
        // 更新进度
        if (switchProgress.value) {
          switchProgress.value.completedSteps = 4
          switchProgress.value.overallProgress = 100
          switchProgress.value.currentStep = '切换完成'
          switchProgress.value.isCompleted = true
          switchProgress.value.rollbackAvailable = result.rollbackAvailable
        }

        // 重新加载供应商数据和健康状态
        await loadSuppliers()
        await loadHealthStatus(request.fromSupplierId)
        await loadHealthStatus(request.toSupplierId)

        // 添加历史记录
        const historyRecord: SupplierSwitchHistory = {
          id: result.switchTime,
          operation: 'switch',
          fromSupplierId: request.fromSupplierId,
          toSupplierId: request.toSupplierId,
          reason: request.switchReason === 'manual' ? '手动切换' :
                  request.switchReason === 'auto_failover' ? '自动故障转移' : '健康检查',
          timestamp: result.switchTime,
          success: true,
          duration: Date.parse(result.switchTime) - Date.parse(startTime),
          backupId: result.backupId
        }
        switchHistory.value.unshift(historyRecord)

        // 添加成功通知
        addNotification({
          id: `switch-success-${Date.now()}`,
          type: 'success',
          title: '供应商切换成功',
          message: `成功从供应商 ${request.fromSupplierId} 切换到供应商 ${request.toSupplierId}`,
          timestamp: new Date().toISOString(),
          read: false
        })

        return result
      } else {
        throw new Error(result.message || '供应商切换失败')
      }
    } catch (error) {
      console.error('供应商切换失败:', error)

      // 更新进度状态
      if (switchProgress.value) {
        switchProgress.value.hasError = true
        switchProgress.value.currentStep = '切换失败'
        switchProgress.value.errorMessage = error instanceof Error ? error.message : '未知错误'
      }

      // 添加失败通知
      addNotification({
        id: `switch-error-${Date.now()}`,
        type: 'error',
        title: '供应商切换失败',
        message: error instanceof Error ? error.message : '未知错误',
        timestamp: new Date().toISOString(),
        read: false
      })

      throw error
    } finally {
      isSwitching.value = false
    }
  }

  // 自动故障转移
  const executeAutoFailover = async (supplierType: string) => {
    try {
      if (!settings.value.enableAutoFailover) {
        console.warn('自动故障转移已禁用')
        return
      }

      const result = await supplierApi.autoFailover(supplierType)

      if (result.success) {
        // 重新加载数据
        await loadAllData()

        // 添加故障转移通知
        addNotification({
          id: `failover-success-${Date.now()}`,
          type: 'warning',
          title: '自动故障转移',
          message: `${supplierType} 供应商已自动切换到备用供应商`,
          timestamp: new Date().toISOString(),
          read: false
        })

        return result
      } else {
        throw new Error(result.message || '自动故障转移失败')
      }
    } catch (error) {
      console.error('自动故障转移失败:', error)

      addNotification({
        id: `failover-error-${Date.now()}`,
        type: 'error',
        title: '自动故障转移失败',
        message: error instanceof Error ? error.message : '自动故障转移操作失败',
        timestamp: new Date().toISOString(),
        read: false
      })

      throw error
    }
  }

  // 模拟切换（用于测试）
  const simulateSwitch = async (request: SupplierSwitchRequest) => {
    try {
      isSwitching.value = true

      const result = await supplierApi.simulateSupplierSwitch(request)

      // 添加模拟通知
      addNotification({
        id: `simulate-${Date.now()}`,
        type: 'info',
        title: '模拟切换',
        message: result.message,
        timestamp: new Date().toISOString(),
        read: false
      })

      return result
    } catch (error) {
      console.error('模拟切换失败:', error)
      throw error
    } finally {
      isSwitching.value = false
    }
  }

  // 健康检查管理
  const runHealthCheck = async (supplierId?: number) => {
    try {
      const results = await loadHealthStatus(supplierId)

      // 检查是否需要自动故障转移
      if (!supplierId && settings.value.enableAutoFailover) {
        for (const [supplierId, health] of healthStatus.value.entries()) {
          if (!health.isHealthy && health.consecutiveFailures >= 3) {
            const supplier = suppliers.value.find(s => s.id === supplierId)
            if (supplier) {
              await executeAutoFailover(supplier.type)
              break // 一次只处理一个故障转移
            }
          }
        }
      }

      return results
    } catch (error) {
      console.error('健康检查失败:', error)
      throw error
    }
  }

  // 故障转移配置管理
  const updateFailoverConfig = async (supplierType: string, config: FailoverConfig) => {
    try {
      const success = await supplierApi.updateFailoverConfig(supplierType, config)

      if (success) {
        failoverConfigs.value.set(supplierType, config)

        addNotification({
          id: `config-update-${Date.now()}`,
          type: 'success',
          title: '配置更新成功',
          message: `${supplierType} 故障转移配置已更新`,
          timestamp: new Date().toISOString(),
          read: false
        })
      }

      return success
    } catch (error) {
      console.error('更新故障转移配置失败:', error)

      addNotification({
        id: `config-error-${Date.now()}`,
        type: 'error',
        title: '配置更新失败',
        message: error instanceof Error ? error.message : '配置更新操作失败',
        timestamp: new Date().toISOString(),
        read: false
      })

      throw error
    }
  }

  // 获取推荐配置
  const getRecommendedFailoverConfig = async (supplierType: string) => {
    try {
      return await supplierApi.getRecommendedFailoverConfig(supplierType)
    } catch (error) {
      console.error('获取推荐故障转移配置失败:', error)
      throw error
    }
  }

  // 进度管理
  const updateProgress = (progress: SupplierSwitchProgress) => {
    switchProgress.value = progress
  }

  const resetProgress = () => {
    switchProgress.value = null
  }

  // 通知管理
  const addNotification = (notification: {
    id: string
    type: 'success' | 'error' | 'warning' | 'info'
    title: string
    message: string
    timestamp: string
    read: boolean
  }) => {
    notifications.value.unshift(notification)

    // 保持最多100条通知
    if (notifications.value.length > 100) {
      notifications.value = notifications.value.slice(0, 100)
    }

    // 如果启用通知，可以在这里添加系统通知逻辑
    if (settings.value.showNotifications) {
      // TODO: 集成系统通知
    }
  }

  const markNotificationAsRead = (id: string) => {
    const notification = notifications.value.find(n => n.id === id)
    if (notification) {
      notification.read = true
    }
  }

  const markAllNotificationsAsRead = () => {
    notifications.value.forEach(n => {
      n.read = true
    })
  }

  const clearNotifications = () => {
    notifications.value = []
  }

  // 设置管理
  const updateSettings = (newSettings: Partial<typeof settings.value>) => {
    settings.value = { ...settings.value, ...newSettings }
    // TODO: 持久化设置到本地存储
  }

  const getSettings = () => {
    return settings.value
  }

  // 工具函数
  const getSupplierName = (supplierId: number) => {
    const supplier = suppliers.value.find(s => s.id === supplierId)
    return supplier?.name || `供应商 ${supplierId}`
  }

  const getHealthStatusText = (supplierId: number) => {
    const health = healthStatus.value.get(supplierId)
    if (!health) return '未知'

    switch (health.status) {
      case 'healthy': return '健康'
      case 'degraded': return '降级'
      case 'unhealthy': return '不健康'
      default: return '未知'
    }
  }

  const canSwitchFromTo = (fromId: number, toId: number) => {
    const fromHealth = healthStatus.value.get(fromId)
    const toHealth = healthStatus.value.get(toId)

    if (!fromHealth || !toHealth) {
      return { canSwitch: false, reason: '健康状态未知' }
    }

    if (!toHealth.isHealthy) {
      return { canSwitch: false, reason: '目标供应商不健康' }
    }

    if (fromHealth.isHealthy && fromHealth.consecutiveFailures < 3) {
      return { canSwitch: false, reason: '源供应商状态良好，无需切换' }
    }

    return { canSwitch: true, reason: '可以切换' }
  }

  // 自动健康检查定时器
  let healthCheckTimer: number | null = null

  const startAutoHealthCheck = () => {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer)
    }

    if (settings.value.autoHealthCheck) {
      healthCheckTimer = setInterval(async () => {
        try {
          await runHealthCheck()
        } catch (error) {
          console.error('自动健康检查失败:', error)
        }
      }, settings.value.healthCheckInterval)
    }
  }

  const stopAutoHealthCheck = () => {
    if (healthCheckTimer) {
      clearInterval(healthCheckTimer)
      healthCheckTimer = null
    }
  }

  // 初始化
  const initialize = async () => {
    try {
      await loadAllData()

      // 从本地存储恢复设置
      // TODO: 从localStorage恢复设置

      // 启动自动健康检查
      startAutoHealthCheck()

      console.log('供应商切换Store初始化完成')
    } catch (error) {
      console.error('供应商切换Store初始化失败:', error)
      throw error
    }
  }

  // 清理
  const cleanup = () => {
    stopAutoHealthCheck()
  }

  return {
    // 状态
    suppliers,
    healthStatus,
    isSwitching,
    switchProgress,
    switchHistory,
    failoverConfigs,
    performanceMetrics,
    notifications,
    settings,

    // 计算属性
    claudeSuppliers,
    codexSuppliers,
    activeClaudeSupplier,
    activeCodexSupplier,
    healthySuppliers,
    unhealthySuppliers,
    suppliersByType,
    healthSummaryByType,
    isReadyForSwitch,
    unreadNotifications,
    recentHistory,
    averageResponseTimeByType,

    // 加载操作
    loadSuppliers,
    loadHealthStatus,
    loadFailoverConfig,
    loadSwitchHistory,
    loadPerformanceMetrics,
    loadAllData,

    // 切换操作
    switchSupplier,
    executeAutoFailover,
    simulateSwitch,

    // 健康检查
    runHealthCheck,

    // 配置管理
    updateFailoverConfig,
    getRecommendedFailoverConfig,

    // 进度管理
    updateProgress,
    resetProgress,

    // 通知管理
    addNotification,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    clearNotifications,

    // 设置管理
    updateSettings,
    getSettings,

    // 工具函数
    getSupplierName,
    getHealthStatusText,
    canSwitchFromTo,

    // 自动健康检查
    startAutoHealthCheck,
    stopAutoHealthCheck,

    // 初始化和清理
    initialize,
    cleanup
  }
})