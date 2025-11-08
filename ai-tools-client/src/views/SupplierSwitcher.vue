<script setup lang="ts">
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useSupplierSwitchStore } from '@/stores/supplierSwitch'
import MonitoringDashboard from '@/components/MonitoringDashboard.vue'
import type {
  Supplier,
  SupplierHealth,
  SupplierSwitchRequest,
  SupplierSwitchResult,
  SupplierSwitchProgress,
  FailoverConfig
} from '@/types'

// Store
const supplierStore = useSupplierSwitchStore()

// 响应式数据
const loading = ref(false)
const autoRefreshTimer = ref<number | null>(null)

// 切换相关状态
const switchDialogVisible = ref(false)
const selectedFromSupplier = ref<number | null>(null)
const selectedToSupplier = ref<number | null>(null)
const switchReason = ref<'manual' | 'auto_failover' | 'health_check'>('manual')
const createBackup = ref(true)
const rollbackOnFailure = ref(true)

// 配置相关
const configDialogVisible = ref(false)
const selectedSupplierType = ref<'claude' | 'codex'>('claude')
const failoverConfig = ref<FailoverConfig | null>(null)

// 历史记录
const historyVisible = ref(false)

// 监控相关
const monitoringVisible = ref(false)
const currentTab = ref('overview') // overview, switching, monitoring

// 进度显示相关
const showDetails = ref(false)
const showTroubleshooting = ref(false)
const troubleshootingTab = ref('common')
const operationLogs = ref<Array<{
  id: string
  timestamp: string
  type: 'info' | 'success' | 'warning' | 'error'
  message: string
}>>([])

// 计算属性
const currentActiveSuppliers = computed(() => {
  const active = []
  const claudeActive = supplierStore.activeClaudeSupplier
  const codexActive = supplierStore.activeCodexSupplier

  if (claudeActive) active.push(claudeActive)
  if (codexActive) active.push(codexActive)

  return active
})

const healthySuppliersByType = computed(() => {
  const claudeHealthy = supplierStore.claudeSuppliers.filter(s => {
    const health = supplierStore.healthStatus.get(s.id!)
    return health?.isHealthy
  })

  const codexHealthy = supplierStore.codexSuppliers.filter(s => {
    const health = supplierStore.healthStatus.get(s.id!)
    return health?.isHealthy
  })

  return { claude: claudeHealthy, codex: codexHealthy }
})

const isSwitchFormValid = computed(() => {
  return selectedFromSupplier.value !== null &&
         selectedToSupplier.value !== null &&
         selectedFromSupplier.value !== selectedToSupplier.value
})

const progressPercentage = computed(() => {
  const progress = supplierStore.switchProgress
  if (!progress) return 0
  return Math.round((progress.completedSteps / progress.totalSteps) * 100)
})

const switchSteps = computed(() => {
  const progress = supplierStore.switchProgress
  if (!progress) return []

  const steps = [
    { id: 'validate', name: '验证切换条件', status: 'completed' as const },
    { id: 'backup', name: '创建备份', status: 'pending' as const },
    { id: 'health_check', name: '健康检查', status: 'pending' as const },
    { id: 'switch', name: '执行切换', status: 'pending' as const },
    { id: 'verify', name: '验证结果', status: 'pending' as const }
  ] as Array<{
    id: string
    name: string
    status: 'pending' | 'completed' | 'process' | 'error'
  }>

  // 根据进度更新步骤状态
  const completedCount = progress.completedSteps
  const updatedSteps = steps.map((step, index) => {
    if (index < completedCount) {
      return { ...step, status: 'completed' as const }
    } else if (index === completedCount && !progress.isCompleted) {
      return { ...step, status: 'process' as const }
    }
    return step
  })

  if (progress.hasError) {
    const failedStepIndex = updatedSteps.findIndex(step => step.status === 'process')
    if (failedStepIndex >= 0) {
      updatedSteps[failedStepIndex] = {
        id: updatedSteps[failedStepIndex]?.id || '',
        name: updatedSteps[failedStepIndex]?.name || '',
        status: 'error' as const
      }
    }
  }

  return updatedSteps
})

// 加载数据
const loadData = async () => {
  loading.value = true
  try {
    await supplierStore.loadAllData()
  } catch (error) {
    ElMessage.error('加载数据失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 刷新健康状态
const refreshHealthStatus = async () => {
  try {
    await supplierStore.runHealthCheck()
    ElMessage.success('健康状态已更新')
  } catch (error) {
    ElMessage.error('健康状态更新失败')
    console.error(error)
  }
}

// 运行健康检查（概览页面使用）
const runHealthCheck = async () => {
  loading.value = true
  try {
    await supplierStore.runHealthCheck()
    ElMessage.success('健康检查完成')
  } catch (error) {
    ElMessage.error('健康检查失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 刷新监控数据
const refreshMonitoringData = async () => {
  loading.value = true
  try {
    await supplierStore.runHealthCheck()
    // 强制更新监控组件数据
    ElMessage.success('监控数据已刷新')
  } catch (error) {
    ElMessage.error('监控数据刷新失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 显示切换对话框
const showSwitchDialog = () => {
  switchDialogVisible.value = true
  resetSwitchForm()
}

// 重置切换表单
const resetSwitchForm = () => {
  const activeSuppliers = currentActiveSuppliers.value
  if (activeSuppliers.length > 0) {
    selectedFromSupplier.value = activeSuppliers[0]?.id || null
  }

  const healthySuppliers = supplierStore.healthySuppliers
  const availableTargets = healthySuppliers.filter(s => s.id !== selectedFromSupplier.value)
  if (availableTargets.length > 0) {
    selectedToSupplier.value = availableTargets[0]?.id || null
  }

  switchReason.value = 'manual'
  createBackup.value = true
  rollbackOnFailure.value = true
}

// 执行供应商切换
const executeSwitch = async () => {
  if (!isSwitchFormValid.value) {
    ElMessage.warning('请完善切换配置信息')
    return
  }

  // 验证切换条件
  const canSwitch = supplierStore.canSwitchFromTo(
    selectedFromSupplier.value!,
    selectedToSupplier.value!
  )

  if (!canSwitch.canSwitch) {
    ElMessage.warning(`切换条件不满足: ${canSwitch.reason}`)
    return
  }

  try {
    // 清空之前的日志
    operationLogs.value = []
    addOperationLog('info', '开始供应商切换流程')

    const fromSupplier = supplierStore.getSupplierName(selectedFromSupplier.value!)
    const toSupplier = supplierStore.getSupplierName(selectedToSupplier.value!)

    addOperationLog('info', `源供应商: ${fromSupplier}`)
    addOperationLog('info', `目标供应商: ${toSupplier}`)
    addOperationLog('info', `切换原因: ${getSwitchReasonLabel(switchReason.value)}`)

    // 构建切换请求
    const request: SupplierSwitchRequest = {
      fromSupplierId: selectedFromSupplier.value!,
      toSupplierId: selectedToSupplier.value!,
      switchReason: switchReason.value,
      createBackup: createBackup.value,
      rollbackOnFailure: rollbackOnFailure.value
    }

    addOperationLog('info', '开始执行切换操作...')

    // 执行切换
    const result = await supplierStore.switchSupplier(request)

    if (result.success) {
      addOperationLog('success', `切换成功: ${result.message}`)
      ElMessage.success('供应商切换成功')
    } else {
      throw new Error(result.message || '切换失败')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    addOperationLog('error', `切换失败: ${errorMessage}`)
    ElMessage.error('供应商切换失败')
    console.error(error)
  }
}

// 执行自动故障转移
const executeAutoFailover = async (supplierType: 'claude' | 'codex') => {
  try {
    addOperationLog('info', `开始执行${supplierType}供应商自动故障转移`)

    const result = await supplierStore.executeAutoFailover(supplierType)

    if (result?.success) {
      addOperationLog('success', `自动故障转移成功: ${result.message}`)
      ElMessage.success(`${supplierType}供应商自动故障转移成功`)
    } else {
      throw new Error(result?.message || '自动故障转移失败')
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    addOperationLog('error', `自动故障转移失败: ${errorMessage}`)
    ElMessage.error('自动故障转移失败')
    console.error(error)
  }
}

// 执行模拟切换
const executeSimulation = async () => {
  if (!isSwitchFormValid.value) {
    ElMessage.warning('请完善切换配置信息')
    return
  }

  try {
    const request: SupplierSwitchRequest = {
      fromSupplierId: selectedFromSupplier.value!,
      toSupplierId: selectedToSupplier.value!,
      switchReason: 'manual',
      createBackup: false,
      rollbackOnFailure: false
    }

    const result = await supplierStore.simulateSwitch(request)

    ElMessage.info(result.message)
  } catch (error) {
    ElMessage.error('模拟切换失败')
    console.error(error)
  }
}

// 显示配置对话框
const showConfigDialog = async (supplierType: 'claude' | 'codex') => {
  selectedSupplierType.value = supplierType
  configDialogVisible.value = true

  try {
    await supplierStore.loadFailoverConfig(supplierType)
    failoverConfig.value = supplierStore.failoverConfigs.get(supplierType) || null
  } catch (error) {
    ElMessage.error('加载故障转移配置失败')
    console.error(error)
  }
}

// 保存故障转移配置
const saveFailoverConfig = async () => {
  if (!failoverConfig.value) return

  try {
    const success = await supplierStore.updateFailoverConfig(selectedSupplierType.value, failoverConfig.value)

    if (success) {
      ElMessage.success('故障转移配置已保存')
      configDialogVisible.value = false
    }
  } catch (error) {
    ElMessage.error('保存故障转移配置失败')
    console.error(error)
  }
}

// 获取推荐配置
const loadRecommendedConfig = async () => {
  try {
    failoverConfig.value = await supplierStore.getRecommendedFailoverConfig(selectedSupplierType.value)
    ElMessage.success('已加载推荐配置')
  } catch (error) {
    ElMessage.error('加载推荐配置失败')
    console.error(error)
  }
}

// 显示历史记录
const showHistory = async () => {
  historyVisible.value = true
  try {
    await supplierStore.loadSwitchHistory()
  } catch (error) {
    ElMessage.error('加载历史记录失败')
    console.error(error)
  }
}

// 取消切换
const cancelSwitch = () => {
  if (supplierStore.isSwitching) {
    ElMessageBox.confirm('切换正在进行中，确定要取消吗？', '确认取消', {
      type: 'warning'
    }).then(() => {
      supplierStore.resetProgress()
      ElMessage.info('已取消供应商切换')
    }).catch(() => {
      // 用户取消
    })
  }
}

// 添加操作日志
const addOperationLog = (type: 'info' | 'success' | 'warning' | 'error', message: string) => {
  operationLogs.value.unshift({
    id: `log-${Date.now()}-${Math.random()}`,
    timestamp: new Date().toISOString(),
    type,
    message
  })

  // 限制日志数量
  if (operationLogs.value.length > 100) {
    operationLogs.value = operationLogs.value.slice(0, 100)
  }
}

// 获取切换原因标签
const getSwitchReasonLabel = (reason: string) => {
  const reasonMap: Record<string, string> = {
    'manual': '手动切换',
    'auto_failover': '自动故障转移',
    'health_check': '健康检查触发'
  }
  return reasonMap[reason] || reason
}

// 获取健康状态文本
const getHealthStatusText = (supplierId: number) => {
  return supplierStore.getHealthStatusText(supplierId)
}

// 获取健康状态类型
const getHealthStatusType = (supplierId: number) => {
  const health = supplierStore.healthStatus.get(supplierId)
  if (!health) return 'info'

  switch (health.status) {
    case 'healthy': return 'success'
    case 'degraded': return 'warning'
    case 'unhealthy': return 'danger'
    default: return 'info'
  }
}

// 获取响应时间颜色
const getResponseTimeColor = (responseTime?: number) => {
  if (!responseTime) return '#c0c4cc' // 灰色
  if (responseTime < 1000) return '#67c23a' // 绿色
  if (responseTime < 3000) return '#e6a23c' // 橙色
  return '#f56c6c' // 红色
}

// 复制诊断信息
const copyDiagnosticInfo = async () => {
  const diagnosticInfo = {
    应用版本: 'v1.0.0',
    供应商总数: supplierStore.suppliers.length,
    健康供应商数量: supplierStore.healthySuppliers.length,
    不健康供应商数量: supplierStore.unhealthySuppliers.length,
    是否切换中: supplierStore.isSwitching,
    切换进度: supplierStore.switchProgress ?
      `${supplierStore.switchProgress.completedSteps}/${supplierStore.switchProgress.totalSteps}` : '无',
    错误状态: supplierStore.switchProgress?.hasError || false,
    操作日志数量: operationLogs.value.length,
    自动健康检查: supplierStore.getSettings().autoHealthCheck,
    健康检查间隔: supplierStore.getSettings().healthCheckInterval + 'ms',
    浏览器信息: navigator.userAgent,
    时间戳: new Date().toISOString()
  }

  try {
    await navigator.clipboard.writeText(JSON.stringify(diagnosticInfo, null, 2))
    ElMessage.success('诊断信息已复制到剪贴板')
  } catch (error) {
    console.error('复制失败:', error)
    ElMessage.error('复制失败，请手动复制')
  }
}

// 启动自动刷新
const startAutoRefresh = () => {
  const settings = supplierStore.getSettings()
  if (settings.autoHealthCheck && settings.healthCheckInterval > 0) {
    autoRefreshTimer.value = window.setInterval(async () => {
      try {
        await supplierStore.runHealthCheck()
      } catch (error) {
        console.error('自动健康检查失败:', error)
      }
    }, settings.healthCheckInterval)
  }
}

// 停止自动刷新
const stopAutoRefresh = () => {
  if (autoRefreshTimer.value) {
    clearInterval(autoRefreshTimer.value)
    autoRefreshTimer.value = null
  }
}

// 生命周期
onMounted(async () => {
  await loadData()
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
  supplierStore.cleanup()
})
</script>

<template>
  <div class="supplier-switcher">
    <!-- 页面头部 -->
    <div class="header">
      <div class="header-left">
        <h2>供应商切换</h2>
        <p class="subtitle">智能供应商健康监控和故障转移管理</p>
      </div>
      <div class="header-right">
        <el-button type="primary" @click="showSwitchDialog" :disabled="supplierStore.isSwitching || supplierStore.healthySuppliers.length < 2">
          <el-icon><Refresh /></el-icon>
          切换供应商
        </el-button>
        <el-button @click="refreshHealthStatus" :loading="loading">
          <el-icon><Refresh /></el-icon>
          刷新状态
        </el-button>
        <el-button @click="showHistory">
          <el-icon><Clock /></el-icon>
          切换历史
        </el-button>
      </div>
    </div>

    <!-- 健康状态概览 -->
    <div class="health-overview">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="overview-card">
            <div class="overview-header">
              <h3>总供应商</h3>
              <el-icon class="overview-icon"><Box /></el-icon>
            </div>
            <div class="overview-content">
              <div class="overview-number">{{ supplierStore.suppliers.length }}</div>
              <div class="overview-label">个供应商</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="overview-card healthy">
            <div class="overview-header">
              <h3>健康供应商</h3>
              <el-icon class="overview-icon"><CircleCheck /></el-icon>
            </div>
            <div class="overview-content">
              <div class="overview-number">{{ supplierStore.healthySuppliers.length }}</div>
              <div class="overview-label">个正常</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="overview-card unhealthy">
            <div class="overview-header">
              <h3>异常供应商</h3>
              <el-icon class="overview-icon"><CircleClose /></el-icon>
            </div>
            <div class="overview-content">
              <div class="overview-number">{{ supplierStore.unhealthySuppliers.length }}</div>
              <div class="overview-label">个异常</div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="overview-card">
            <div class="overview-header">
              <h3>平均响应时间</h3>
              <el-icon class="overview-icon"><Timer /></el-icon>
            </div>
            <div class="overview-content">
              <div class="overview-number">
                {{ Math.round(supplierStore.averageResponseTimeByType.claude || 0) }}ms
              </div>
              <div class="overview-label">Claude</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 供应商健康状态详情 -->
    <div class="supplier-details">
      <el-card>
        <template #header>
          <div class="card-header">
            <h3>供应商健康状态</h3>
            <div class="header-actions">
              <el-button size="small" @click="showConfigDialog('claude')">
                <el-icon><Setting /></el-icon>
                Claude配置
              </el-button>
              <el-button size="small" @click="showConfigDialog('codex')">
                <el-icon><Setting /></el-icon>
                Codex配置
              </el-button>
            </div>
          </div>
        </template>

        <el-tabs v-model="currentTab">
          <el-tab-pane label="概览" name="overview">
            <div class="overview-section">
              <!-- 健康状态概览卡片 -->
              <div class="health-overview">
                <el-row :gutter="20">
                  <el-col :span="6">
                    <el-card class="overview-card">
                      <div class="overview-number">{{ supplierStore.suppliers.length }}</div>
                      <div class="overview-label">个供应商</div>
                    </el-card>
                  </el-col>
                  <el-col :span="6">
                    <el-card class="overview-card healthy">
                      <div class="overview-number">{{ supplierStore.healthySuppliers.length }}</div>
                      <div class="overview-label">个健康</div>
                    </el-card>
                  </el-col>
                  <el-col :span="6">
                    <el-card class="overview-card unhealthy">
                      <div class="overview-number">{{ supplierStore.unhealthySuppliers.length }}</div>
                      <div class="overview-label">个异常</div>
                    </el-card>
                  </el-col>
                  <el-col :span="6">
                    <el-card class="overview-card switching">
                      <div class="overview-number">{{ supplierStore.isReadyForSwitch ? '就绪' : '忙碌' }}</div>
                      <div class="overview-label">切换状态</div>
                    </el-card>
                  </el-col>
                </el-row>
              </div>

              <!-- 快速操作按钮 -->
              <div class="quick-actions" style="margin-top: 20px;">
                <el-row :gutter="15">
                  <el-col :span="6">
                    <el-button
                      type="primary"
                      @click="runHealthCheck"
                      :loading="loading"
                      style="width: 100%"
                    >
                      运行健康检查
                    </el-button>
                  </el-col>
                  <el-col :span="6">
                    <el-button
                      type="warning"
                      @click="switchDialogVisible = true"
                      :disabled="!supplierStore.isReadyForSwitch"
                      style="width: 100%"
                    >
                      手动切换供应商
                    </el-button>
                  </el-col>
                  <el-col :span="6">
                    <el-button
                      type="info"
                      @click="configDialogVisible = true"
                      style="width: 100%"
                    >
                      故障转移配置
                    </el-button>
                  </el-col>
                  <el-col :span="6">
                    <el-button
                      type="success"
                      @click="historyVisible = true"
                      style="width: 100%"
                    >
                      切换历史
                    </el-button>
                  </el-col>
                </el-row>
              </div>

              <!-- 实时监控预览 -->
              <div style="margin-top: 20px;">
                <el-card header="实时状态监控">
                  <MonitoringDashboard :compact="true" />
                </el-card>
              </div>
            </div>
          </el-tab-pane>

          <el-tab-pane label="供应商管理" name="suppliers">
            <el-tabs>
              <el-tab-pane label="Claude 供应商" name="claude">
                <el-table :data="supplierStore.claudeSuppliers" stripe>
                  <el-table-column prop="name" label="供应商名称" />
                  <el-table-column label="状态" width="120">
                    <template #default="{ row }">
                      <el-tag :type="getHealthStatusType(row.id!)">
                        {{ getHealthStatusText(row.id!) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="响应时间" width="120">
                    <template #default="{ row }">
                      <span :style="{ color: getResponseTimeColor(supplierStore.healthStatus.get(row.id!)?.responseTime || 0) }">
                        {{ supplierStore.healthStatus.get(row.id!)?.responseTime ? `${supplierStore.healthStatus.get(row.id!)?.responseTime}ms` : '-' }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="连续失败" width="100">
                    <template #default="{ row }">
                      {{ supplierStore.healthStatus.get(row.id!)?.consecutiveFailures || 0 }}
                    </template>
                  </el-table-column>
                  <el-table-column label="运行时间" width="100">
                    <template #default="{ row }">
                      {{ Math.round(supplierStore.healthStatus.get(row.id!)?.uptimePercentage || 0) }}%
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="200">
                    <template #default="{ row }">
                      <el-button
                        size="small"
                        type="primary"
                        @click="executeAutoFailover('claude')"
                        :disabled="row.isActive || supplierStore.isSwitching"
                      >
                        设为活跃
                      </el-button>
                      <el-button
                        size="small"
                        @click="refreshHealthStatus"
                      >
                        检查
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="Codex 供应商" name="codex">
                <el-table :data="supplierStore.codexSuppliers" stripe>
                  <el-table-column prop="name" label="供应商名称" />
                  <el-table-column label="状态" width="120">
                    <template #default="{ row }">
                      <el-tag :type="getHealthStatusType(row.id!)">
                        {{ getHealthStatusText(row.id!) }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column label="响应时间" width="120">
                    <template #default="{ row }">
                      <span :style="{ color: getResponseTimeColor(supplierStore.healthStatus.get(row.id!)?.responseTime || 0) }">
                        {{ supplierStore.healthStatus.get(row.id!)?.responseTime ? `${supplierStore.healthStatus.get(row.id!)?.responseTime}ms` : '-' }}
                      </span>
                    </template>
                  </el-table-column>
                  <el-table-column label="连续失败" width="100">
                    <template #default="{ row }">
                      {{ supplierStore.healthStatus.get(row.id!)?.consecutiveFailures || 0 }}
                    </template>
                  </el-table-column>
                  <el-table-column label="运行时间" width="100">
                    <template #default="{ row }">
                      {{ Math.round(supplierStore.healthStatus.get(row.id!)?.uptimePercentage || 0) }}%
                    </template>
                  </el-table-column>
                  <el-table-column label="操作" width="200">
                    <template #default="{ row }">
                      <el-button
                        size="small"
                        type="primary"
                        @click="executeAutoFailover('codex')"
                        :disabled="row.isActive || supplierStore.isSwitching"
                      >
                        设为活跃
                      </el-button>
                      <el-button
                        size="small"
                        @click="refreshHealthStatus"
                      >
                        检查
                      </el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </el-tab-pane>

          <el-tab-pane label="实时监控" name="monitoring">
            <div class="monitoring-full-section">
              <MonitoringDashboard />
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>

  
    <!-- 切换进度显示 -->
    <div v-if="supplierStore.isSwitching || supplierStore.switchProgress" class="progress-section">
      <el-card>
        <template #header>
          <div class="card-header">
            <h3>切换进度</h3>
            <div class="header-actions">
              <el-button
                size="small"
                @click="showDetails = !showDetails"
              >
                {{ showDetails ? '隐藏详情' : '显示详情' }}
              </el-button>
              <el-button
                size="small"
                type="danger"
                @click="cancelSwitch"
              >
                取消切换
              </el-button>
            </div>
          </div>
        </template>

        <div class="progress-content">
          <el-progress
            :percentage="progressPercentage"
            :status="supplierStore.switchProgress?.hasError ? 'exception' : 'success'"
            :stroke-width="8"
          />

          <div class="progress-info">
            <p><strong>当前步骤:</strong> {{ supplierStore.switchProgress?.currentStep || '准备中...' }}</p>
            <p><strong>进度:</strong> {{ supplierStore.switchProgress?.completedSteps || 0 }} / {{ supplierStore.switchProgress?.totalSteps || 0 }}</p>
          </div>

          <!-- 详细步骤 -->
          <div v-if="showDetails" class="steps-detail">
            <h4>详细步骤</h4>
            <el-steps :active="supplierStore.switchProgress?.completedSteps || 0" direction="vertical">
              <el-step
                v-for="step in switchSteps"
                :key="step.id"
                :title="step.name"
                :status="step.status === 'error' ? 'error' : step.status === 'process' ? 'process' : step.status"
                :description="step.status === 'error' ? '步骤执行失败' : ''"
              />
            </el-steps>
          </div>

          <!-- 操作日志 -->
          <div v-if="showDetails" class="operation-logs">
            <h4>操作日志</h4>
            <el-timeline>
              <el-timeline-item
                v-for="log in operationLogs.slice(0, 10)"
                :key="log.id"
                :timestamp="new Date(log.timestamp).toLocaleTimeString()"
                :type="log.type"
              >
                {{ log.message }}
              </el-timeline-item>
            </el-timeline>
          </div>

          <!-- 故障排除 -->
          <div v-if="showDetails && supplierStore.switchProgress?.hasError" class="troubleshooting">
            <h4>故障排除</h4>
            <el-tabs v-model="troubleshootingTab">
              <el-tab-pane label="常见问题" name="common">
                <div class="troubleshooting-content">
                  <p><strong>可能的原因:</strong></p>
                  <ul>
                    <li>目标供应商健康状态异常</li>
                    <li>网络连接问题</li>
                    <li>配置验证失败</li>
                    <li>权限或认证问题</li>
                  </ul>

                  <p><strong>建议的解决方案:</strong></p>
                  <ul>
                    <li>检查目标供应商的健康状态</li>
                    <li>验证网络连接</li>
                    <li>确认配置信息正确</li>
                    <li>查看详细错误日志</li>
                  </ul>
                </div>
              </el-tab-pane>

              <el-tab-pane label="诊断信息" name="diagnostic">
                <div class="diagnostic-content">
                  <el-button @click="copyDiagnosticInfo" size="small">
                    <el-icon><DocumentCopy /></el-icon>
                    复制诊断信息
                  </el-button>

                  <div class="diagnostic-info">
                    <p><strong>系统信息:</strong></p>
                    <ul>
                      <li>切换状态: {{ supplierStore.isSwitching ? '进行中' : '空闲' }}</li>
                      <li>健康供应商数: {{ supplierStore.healthySuppliers.length }}</li>
                      <li>异常供应商数: {{ supplierStore.unhealthySuppliers.length }}</li>
                      <li>当前进度: {{ progressPercentage }}%</li>
                    </ul>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
          </div>
        </div>
      </el-card>
    </div>

    <!-- 切换对话框 -->
    <el-dialog
      v-model="switchDialogVisible"
      title="供应商切换"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="{ selectedFromSupplier, selectedToSupplier, switchReason, createBackup, rollbackOnFailure }" label-width="120px">
        <el-form-item label="源供应商" required>
          <el-select v-model="selectedFromSupplier" placeholder="选择源供应商" style="width: 100%">
            <el-option
              v-for="supplier in supplierStore.suppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
              :disabled="!supplier.isActive"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="目标供应商" required>
          <el-select v-model="selectedToSupplier" placeholder="选择目标供应商" style="width: 100%">
            <el-option
              v-for="supplier in supplierStore.healthySuppliers"
              :key="supplier.id"
              :label="supplier.name"
              :value="supplier.id"
              :disabled="supplier.id === selectedFromSupplier"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="切换原因">
          <el-radio-group v-model="switchReason">
            <el-radio label="manual">手动切换</el-radio>
            <el-radio label="auto_failover">自动故障转移</el-radio>
            <el-radio label="health_check">健康检查触发</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="createBackup">创建备份</el-checkbox>
        </el-form-item>

        <el-form-item>
          <el-checkbox v-model="rollbackOnFailure">失败时自动回滚</el-checkbox>
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="switchDialogVisible = false">取消</el-button>
          <el-button @click="executeSimulation" :disabled="!isSwitchFormValid">模拟切换</el-button>
          <el-button type="primary" @click="executeSwitch" :disabled="!isSwitchFormValid || supplierStore.isSwitching">
            执行切换
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 故障转移配置对话框 -->
    <el-dialog
      v-model="configDialogVisible"
      :title="`${selectedSupplierType === 'claude' ? 'Claude' : 'Codex'} 故障转移配置`"
      width="700px"
    >
      <el-form v-if="failoverConfig" :model="failoverConfig" label-width="150px">
        <el-form-item label="启用自动故障转移">
          <el-switch v-model="failoverConfig.enabled" />
        </el-form-item>

        <el-form-item label="最大连续失败次数">
          <el-input-number v-model="failoverConfig.maxConsecutiveFailures" :min="1" :max="10" />
        </el-form-item>

        <el-form-item label="最大响应时间(ms)">
          <el-input-number v-model="failoverConfig.maxResponseTimeMs" :min="1000" :max="60000" :step="1000" />
        </el-form-item>

        <el-form-item label="最小成功率(%)">
          <el-input-number v-model="failoverConfig.minSuccessRate" :min="50" :max="100" :step="5" />
        </el-form-item>

        <el-form-item label="自动回滚">
          <el-switch v-model="failoverConfig.autoRollback" />
        </el-form-item>

        <el-form-item label="回滚延迟(秒)" v-if="failoverConfig.autoRollback">
          <el-input-number v-model="failoverConfig.rollbackDelaySeconds" :min="60" :max="3600" :step="60" />
        </el-form-item>
      </el-form>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="loadRecommendedConfig">加载推荐配置</el-button>
          <el-button @click="configDialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveFailoverConfig">保存配置</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 历史记录对话框 -->
    <el-dialog v-model="historyVisible" title="切换历史记录" width="800px">
      <el-table :data="supplierStore.recentHistory" stripe>
        <el-table-column prop="timestamp" label="时间" width="180">
          <template #default="{ row }">
            {{ new Date(row.timestamp).toLocaleString() }}
          </template>
        </el-table-column>
        <el-table-column prop="operation" label="操作" width="100">
          <template #default="{ row }">
            <el-tag :type="row.operation === 'switch' ? 'primary' : 'warning'">
              {{ row.operation === 'switch' ? '切换' : '故障转移' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="从供应商" width="120">
          <template #default="{ row }">
            {{ supplierStore.getSupplierName(row.fromSupplierId) }}
          </template>
        </el-table-column>
        <el-table-column label="到供应商" width="120">
          <template #default="{ row }">
            {{ supplierStore.getSupplierName(row.toSupplierId) }}
          </template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" />
        <el-table-column label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.success ? 'success' : 'danger'">
              {{ row.success ? '成功' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="duration" label="耗时" width="80">
          <template #default="{ row }">
            {{ row.duration ? `${row.duration}ms` : '-' }}
          </template>
        </el-table-column>
      </el-table>
    </el-dialog>
  </div>
</template>

<style scoped>
.supplier-switcher {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
  padding-bottom: 20px;
  border-bottom: 1px solid #e4e7ed;
}

.header-left h2 {
  margin: 0 0 8px 0;
  color: #303133;
  font-size: 24px;
  font-weight: 600;
}

.subtitle {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.health-overview {
  margin-bottom: 30px;
}

.overview-card {
  height: 120px;
}

.overview-card.healthy {
  border-left: 4px solid #67c23a;
}

.overview-card.unhealthy {
  border-left: 4px solid #f56c6c;
}

.overview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.overview-header h3 {
  margin: 0;
  color: #606266;
  font-size: 14px;
  font-weight: 500;
}

.overview-icon {
  font-size: 20px;
  color: #c0c4cc;
}

.overview-content {
  text-align: center;
}

.overview-number {
  font-size: 32px;
  font-weight: 600;
  color: #303133;
  line-height: 1;
  margin-bottom: 8px;
}

.overview-label {
  color: #909399;
  font-size: 12px;
}

.supplier-details {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  color: #303133;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.progress-section {
  margin-bottom: 30px;
}

.progress-content {
  padding: 20px 0;
}

.progress-info {
  margin: 20px 0;
}

.progress-info p {
  margin: 8px 0;
  color: #606266;
}

.steps-detail,
.operation-logs,
.troubleshooting {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.steps-detail h4,
.operation-logs h4,
.troubleshooting h4 {
  margin: 0 0 16px 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.troubleshooting-content ul,
.diagnostic-info ul {
  margin: 12px 0;
  padding-left: 20px;
}

.troubleshooting-content li,
.diagnostic-info li {
  margin: 8px 0;
  color: #606266;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .supplier-switcher {
    padding: 16px;
  }

  .header {
    flex-direction: column;
    gap: 16px;
    align-items: stretch;
  }

  .header-right {
    justify-content: center;
  }

  .overview-card {
    height: 100px;
  }

  .overview-number {
    font-size: 24px;
  }
}
</style>