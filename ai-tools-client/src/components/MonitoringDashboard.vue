<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { ElRow, ElCol, ElCard, ElProgress, ElTag, ElAlert, ElButton, ElTooltip, ElMessage } from 'element-plus'
import { useSupplierSwitchStore } from '@/stores/supplierSwitch'
import type { SupplierPerformanceMetrics } from '@/types'

// Props
interface Props {
  compact?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compact: false
})

const supplierStore = useSupplierSwitchStore()

// Helper函数
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

// 响应式数据
const realTimeData = ref({
  timestamp: new Date(),
  healthChecks: 0,
  activeFailovers: 0,
  responseTime: 0,
  successRate: 100
})

const chartData = ref({
  responseTimeHistory: [] as Array<{ time: string; claude: number; codex: number }>,
  successRateHistory: [] as Array<{ time: string; claude: number; codex: number }>,
  requestVolumeHistory: [] as Array<{ time: string; claude: number; codex: number }>
})

// 定时器
const monitoringTimer = ref<number | null>(null)
const historyTimer = ref<number | null>(null)

// 计算属性
const overallHealthStatus = computed(() => {
  const totalSuppliers = supplierStore.suppliers.length
  const healthyCount = supplierStore.healthySuppliers.length
  const percentage = totalSuppliers > 0 ? Math.round((healthyCount / totalSuppliers) * 100) : 100

  if (percentage >= 90) return { status: 'success', text: '优秀', color: '#67c23a', percentage }
  if (percentage >= 70) return { status: 'warning', text: '良好', color: '#e6a23c', percentage }
  return { status: 'danger', text: '异常', color: '#f56c6c', percentage }
})

const criticalIssues = computed(() => {
  const issues: Array<{
    type: string
    severity: string
    message: string
    supplier?: any
    responseTime?: number
  }> = []

  // 检查不健康的供应商
  supplierStore.unhealthySuppliers.forEach(supplier => {
    const health = supplierStore.healthStatus.get(supplier.id!)
    if (health) {
      issues.push({
        type: 'supplier',
        severity: 'error',
        message: `供应商 ${supplier.name} 健康状态异常`,
        supplier
      })
    }
  })

  // 检查响应时间过慢
  supplierStore.suppliers.forEach(supplier => {
    const health = supplierStore.healthStatus.get(supplier.id!)
    if (health && health.responseTime > 5000) {
      issues.push({
        type: 'performance',
        severity: 'warning',
        message: `供应商 ${supplier.name} 响应时间过慢 (${health.responseTime}ms)`,
        supplier
      })
    }
  })

  return issues
})

const performanceSummary = computed(() => {
  const claudeMetrics = supplierStore.averageResponseTimeByType.claude
  const codexMetrics = supplierStore.averageResponseTimeByType.codex

  return {
    claude: {
      avgResponseTime: claudeMetrics,
      totalSuppliers: supplierStore.claudeSuppliers.length,
      healthyCount: supplierStore.claudeSuppliers.filter(s => {
        const health = supplierStore.healthStatus.get(s.id!)
        return health?.isHealthy
      }).length
    },
    codex: {
      avgResponseTime: codexMetrics,
      totalSuppliers: supplierStore.codexSuppliers.length,
      healthyCount: supplierStore.codexSuppliers.filter(s => {
        const health = supplierStore.healthStatus.get(s.id!)
        return health?.isHealthy
      }).length
    }
  }
})

const recentFailovers = computed(() => {
  return supplierStore.switchHistory.slice(0, 5).filter(record =>
    record.operation === 'failover' && !record.success
  )
})

// 更新实时数据
const updateRealTimeData = () => {
  const now = new Date()
  realTimeData.value.timestamp = now

  // 更新健康检查统计
  realTimeData.value.healthChecks = supplierStore.suppliers.length

  // 更新响应时间
  const allResponseTimes = Array.from(supplierStore.healthStatus.values())
    .map(h => h.responseTime)
    .filter(rt => rt > 0)
  realTimeData.value.responseTime = allResponseTimes.length > 0
    ? Math.round(allResponseTimes.reduce((sum, rt) => sum + rt, 0) / allResponseTimes.length)
    : 0

  // 更新成功率
  const totalRequests = Array.from(supplierStore.healthStatus.values())
    .reduce((sum, h) => sum + h.totalRequests, 0)
  const failedRequests = Array.from(supplierStore.healthStatus.values())
    .reduce((sum, h) => sum + h.failedRequests, 0)
  realTimeData.value.successRate = totalRequests > 0
    ? ((totalRequests - failedRequests) / totalRequests) * 100
    : 100
}

// 更新历史数据
const updateHistoryData = () => {
  const now = new Date().toLocaleTimeString()

  // 更新响应时间历史
  const claudeRT = supplierStore.averageResponseTimeByType.claude || 0
  const codexRT = supplierStore.averageResponseTimeByType.codex || 0

  chartData.value.responseTimeHistory.push({
    time: now,
    claude: claudeRT,
    codex: codexRT
  })

  // 更新成功率历史
  const claudeSuppliers = supplierStore.claudeSuppliers
  const codexSuppliers = supplierStore.codexSuppliers

  const claudeSuccessRate = claudeSuppliers.length > 0
    ? (claudeSuppliers.filter(s => {
        const health = supplierStore.healthStatus.get(s.id!)
        return health?.isHealthy
      }).length / claudeSuppliers.length) * 100
    : 100

  const codexSuccessRate = codexSuppliers.length > 0
    ? (codexSuppliers.filter(s => {
        const health = supplierStore.healthStatus.get(s.id!)
        return health?.isHealthy
      }).length / codexSuppliers.length) * 100
    : 100

  chartData.value.successRateHistory.push({
    time: now,
    claude: claudeSuccessRate,
    codex: codexSuccessRate
  })

  // 保持历史数据在合理范围内
  const maxHistoryLength = 20
  if (chartData.value.responseTimeHistory.length > maxHistoryLength) {
    chartData.value.responseTimeHistory = chartData.value.responseTimeHistory.slice(-maxHistoryLength)
  }
  if (chartData.value.successRateHistory.length > maxHistoryLength) {
    chartData.value.successRateHistory = chartData.value.successRateHistory.slice(-maxHistoryLength)
  }
}

// 手动刷新数据
const refreshData = async () => {
  try {
    await supplierStore.loadAllData()
    updateRealTimeData()
    ElMessage.success('监控数据已刷新')
  } catch (error) {
    ElMessage.error('刷新监控数据失败')
    console.error(error)
  }
}

// 启动监控
const startMonitoring = () => {
  // 实时数据更新（每5秒）
  if (monitoringTimer.value) clearInterval(monitoringTimer.value)
  monitoringTimer.value = window.setInterval(() => {
    updateRealTimeData()
  }, 5000)

  // 历史数据更新（每30秒）
  if (historyTimer.value) clearInterval(historyTimer.value)
  historyTimer.value = window.setInterval(() => {
    updateHistoryData()
  }, 30000)
}

// 停止监控
const stopMonitoring = () => {
  if (monitoringTimer.value) {
    clearInterval(monitoringTimer.value)
    monitoringTimer.value = null
  }
  if (historyTimer.value) {
    clearInterval(historyTimer.value)
    historyTimer.value = null
  }
}

// 导出监控数据
const exportMonitoringData = () => {
  const exportData = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSuppliers: supplierStore.suppliers.length,
      healthySuppliers: supplierStore.healthySuppliers.length,
      unhealthySuppliers: supplierStore.unhealthySuppliers.length,
      overallHealth: overallHealthStatus.value,
      averageResponseTime: realTimeData.value.responseTime,
      overallSuccessRate: realTimeData.value.successRate
    },
    performance: performanceSummary.value,
    criticalIssues: criticalIssues.value,
    realTimeData: realTimeData.value,
    chartData: chartData.value,
    recentFailovers: recentFailovers.value,
    detailedHealthStatus: Array.from(supplierStore.healthStatus.entries()).map(([id, health]) => ({
      supplierName: supplierStore.getSupplierName(id),
      ...health
    }))
  }

  // 创建下载链接
  const dataStr = JSON.stringify(exportData, null, 2)
  const blob = new Blob([dataStr], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = `supplier-monitoring-data-${new Date().toISOString().slice(0, 10)}.json`
  link.click()

  URL.revokeObjectURL(url)
  ElMessage.success('监控数据已导出')
}

// 生命周期
onMounted(() => {
  updateRealTimeData()
  updateHistoryData()
  startMonitoring()
})

onUnmounted(() => {
  stopMonitoring()
})
</script>

<template>
  <div class="monitoring-dashboard">
    <!-- 监控概览 -->
    <div class="overview-section">
      <el-row :gutter="20">
        <el-col :span="6">
          <el-card class="overview-card">
            <div class="card-header">
              <h3>整体健康状态</h3>
              <el-tag
                :type="overallHealthStatus.status as any"
                effect="dark"
              >
                {{ overallHealthStatus.text }}
              </el-tag>
            </div>
            <div class="card-content">
              <div class="health-progress">
                <el-progress
                  type="circle"
                  :percentage="overallHealthStatus.percentage"
                  :color="overallHealthStatus.color"
                  :width="120"
                  :stroke-width="8"
                />
                <div class="health-stats">
                  <div class="stat-item">
                    <span class="stat-number">{{ supplierStore.healthySuppliers.length }}</span>
                    <span class="stat-label">健康</span>
                  </div>
                  <div class="stat-item">
                    <span class="stat-number">{{ supplierStore.unhealthySuppliers.length }}</span>
                    <span class="stat-label">异常</span>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="overview-card">
            <div class="card-header">
              <h3>平均响应时间</h3>
              <el-tag
                :type="realTimeData.responseTime < 1000 ? 'success' : realTimeData.responseTime < 3000 ? 'warning' : 'danger'"
                effect="dark"
              >
                {{ realTimeData.responseTime }}ms
              </el-tag>
            </div>
            <div class="card-content">
              <div class="response-time-stats">
                <div class="rt-item">
                  <span class="rt-number">{{ Math.round(performanceSummary.claude?.avgResponseTime || 0) }}</span>
                  <span class="rt-label">Claude</span>
                </div>
                <div class="rt-item">
                  <span class="rt-number">{{ Math.round(performanceSummary.codex?.avgResponseTime || 0) }}</span>
                  <span class="rt-label">Codex</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="overview-card">
            <div class="card-header">
              <h3>成功率</h3>
              <el-tag
                :type="realTimeData.successRate >= 95 ? 'success' : 'warning'"
                effect="dark"
              >
                {{ Math.round(realTimeData.successRate) }}%
              </el-tag>
            </div>
            <div class="card-content">
              <div class="success-rate-stats">
                <div class="sr-item">
                  <span class="sr-number">{{ Math.round(performanceSummary.claude.healthyCount) }}</span>
                  <span class="sr-label">/{{ performanceSummary.claude.totalSuppliers }} Claude</span>
                </div>
                <div class="sr-item">
                  <span class="sr-number">{{ Math.round(performanceSummary.codex.healthyCount) }}</span>
                  <span class="sr-label">/{{ performanceSummary.codex.totalSuppliers }} Codex</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="6">
          <el-card class="overview-card">
            <div class="card-header">
              <h3>实时状态</h3>
              <div class="status-indicator" :class="{ active: true }"></div>
            </div>
            <div class="card-content">
              <div class="real-time-stats">
                <div class="rt-stat">
                  <span class="rt-number">{{ realTimeData.healthChecks }}</span>
                  <span class="rt-label">监控供应商</span>
                </div>
                <div class="rt-stat">
                  <span class="rt-number">{{ realTimeData.activeFailovers }}</span>
                  <span class="rt-label">活跃故障转移</span>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 关键问题警报 -->
    <div v-if="criticalIssues.length > 0" class="alerts-section">
      <el-alert
        title="检测到关键问题"
        type="error"
        show-icon
        :closable="false"
      >
        <div class="issues-list">
          <div
            v-for="issue in criticalIssues"
            :key="issue.supplier.id"
            class="issue-item"
          >
            <el-tag :type="issue.severity === 'error' ? 'danger' : 'warning'" size="small">
              {{ issue.type === 'supplier' ? '供应商' : '性能' }}
            </el-tag>
            <span class="issue-message">{{ issue.message }}</span>
          </div>
        </div>
      </el-alert>
    </div>

    <!-- 性能图表 -->
    <div class="charts-section">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-card>
            <template #header>
              <div class="card-header">
                <h3>响应时间趋势</h3>
                <el-button size="small" @click="refreshData">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </template>
            <div class="chart-container">
              <div class="simple-chart">
                <div class="chart-legend">
                  <span class="legend-item claude">Claude</span>
                  <span class="legend-item codex">Codex</span>
                </div>
                <div class="chart-bars">
                  <div
                    v-for="(item, index) in chartData.responseTimeHistory.slice(-10)"
                    :key="item.time"
                    class="chart-bar-group"
                  >
                    <div class="chart-bar claude" :style="{ height: `${Math.min(item.claude / 10, 20)}px` }"></div>
                    <div class="chart-bar codex" :style="{ height: `${Math.min(item.codex / 10, 20)}px` }"></div>
                    <div class="chart-time">{{ item.time }}</div>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <el-col :span="12">
          <el-card>
            <template #header>
              <div class="card-header">
                <h3>成功率趋势</h3>
                <el-button size="small" @click="refreshData">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </template>
            <div class="chart-container">
              <div class="simple-chart">
                <div class="chart-legend">
                  <span class="legend-item claude">Claude</span>
                  <span class="legend-item codex">Codex</span>
                </div>
                <div class="chart-bars">
                  <div
                    v-for="(item, index) in chartData.successRateHistory.slice(-10)"
                    :key="item.time"
                    class="chart-bar-group"
                  >
                    <div class="chart-bar claude" :style="{ height: `${item.claude / 5}px` }"></div>
                    <div class="chart-bar codex" :style="{ height: `${item.codex / 5}px` }"></div>
                    <div class="chart-time">{{ item.time }}</div>
                  </div>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 详细监控数据 -->
    <div class="details-section">
      <el-card>
        <template #header>
          <div class="card-header">
            <h3>详细监控数据</h3>
            <div class="header-actions">
              <el-button size="small" @click="exportMonitoringData">
                <el-icon><Download /></el-icon>
                导出数据
              </el-button>
              <el-button size="small" @click="refreshData">
                <el-icon><Refresh /></el-icon>
                刷新数据
              </el-button>
            </div>
          </div>
        </template>

        <el-tabs>
          <el-tab-pane label="供应商状态" name="suppliers">
            <el-table :data="supplierStore.suppliers" stripe>
              <el-table-column prop="name" label="供应商名称" />
              <el-table-column prop="type" label="类型" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.type === 'claude' ? 'primary' : 'success'">
                    {{ row.type === 'claude' ? 'Claude' : 'Codex' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="健康状态" width="120">
                <template #default="{ row }">
                  <el-tag :type="getHealthStatusType(row.id!)">
                    {{ supplierStore.getHealthStatusText(row.id!) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="响应时间" width="120">
                <template #default="{ row }">
                  {{ supplierStore.healthStatus.get(row.id!)?.responseTime || '-' }}ms
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
              <el-table-column label="最后检查" width="160">
                <template #default="{ row }">
                  {{ supplierStore.healthStatus.get(row.id!)?.lastCheckTime
                    ? new Date(supplierStore.healthStatus.get(row.id!)!.lastCheckTime).toLocaleString()
                    : '-' }}
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>

          <el-tab-pane label="切换历史" name="history">
            <el-table :data="supplierStore.recentHistory" stripe>
              <el-table-column prop="timestamp" label="时间" width="180">
                <template #default="{ row }">
                  {{ new Date(row.timestamp || '').toLocaleString() }}
                </template>
              </el-table-column>
              <el-table-column prop="operation" label="操作" width="100">
                <template #default="{ row }">
                  <el-tag :type="row.operation === 'switch' ? 'primary' : 'warning'">
                    {{ row.operation === 'switch' ? '切换' : '故障转移' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.success ? 'success' : 'danger'">
                    {{ row.success ? '成功' : '失败' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="reason" label="原因" />
              <el-table-column prop="duration" label="耗时" width="80">
                <template #default="{ row }">
                  {{ row.duration ? `${row.duration}ms` : '-' }}
                </template>
              </el-table-column>
            </el-table>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>

    <!-- 监控控制 -->
    <div class="control-section">
      <el-card>
        <template #header>
          <div class="card-header">
            <h3>监控控制</h3>
            <div class="status-info">
              <div class="status-indicator" :class="{ active: monitoringTimer !== null }"></div>
              <span>{{ monitoringTimer ? '监控中' : '已停止' }}</span>
            </div>
          </div>
        </template>
        <div class="control-content">
          <el-button
            type="primary"
            @click="startMonitoring"
            :disabled="monitoringTimer !== null"
          >
            启动监控
          </el-button>
          <el-button
            @click="stopMonitoring"
            :disabled="monitoringTimer === null"
          >
            停止监控
          </el-button>
          <el-button @click="refreshData">
            <el-icon><Refresh /></el-icon>
            刷新数据
          </el-button>
          <el-button @click="exportMonitoringData">
            <el-icon><Download /></el-icon>
            导出数据
          </el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<style scoped>
.monitoring-dashboard {
  padding: 20px;
  max-width: 1600px;
  margin: 0 auto;
}

.overview-section {
  margin-bottom: 30px;
}

.charts-section,
.details-section,
.control-section {
  margin-bottom: 30px;
}

.alerts-section {
  margin-bottom: 30px;
}

.overview-card {
  height: 160px;
  text-align: center;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.status-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #f56c6c;
  margin-left: 8px;
  transition: all 0.3s ease;
}

.status-indicator.active {
  background: #67c23a;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.2);
    opacity: 0.7;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.card-content {
  display: flex;
  flex-direction: column;
  justify-content: center;
  height: calc(100% - 80px);
}

.health-progress {
  margin-bottom: 16px;
}

.health-stats {
  display: flex;
  justify-content: space-around;
}

.stat-item,
.rt-item,
.sr-item,
.rt-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-number,
.rt-number,
.sr-number {
  font-size: 24px;
  font-weight: 600;
  color: #303133;
}

.stat-label,
.rt-label,
.sr-label {
  font-size: 12px;
  color: #909399;
}

.response-time-stats {
  display: flex;
  justify-content: space-around;
}

.success-rate-stats {
  display: flex;
  justify-content: space-around;
}

.real-time-stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rt-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.issues-list {
  margin-top: 12px;
}

.issue-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid #f0f0f0;
}

.issue-item:last-child {
  border-bottom: none;
}

.issue-message {
  color: #606266;
  font-size: 14px;
}

.chart-container {
  height: 200px;
  padding: 10px 0;
}

.simple-chart {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.chart-legend {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.legend-item {
  font-size: 12px;
  padding: 4px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.legend-item.claude {
  background: #409eff;
  color: white;
}

.legend-item.codex {
  background: #67c23a;
  color: white;
}

.chart-bars {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 4px;
}

.chart-bar-group {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 20px;
}

.chart-bar {
  width: 60px;
  background: #409eff;
  border-radius: 2px;
  transition: all 0.3s ease;
}

.chart-bar.claude {
  background: #409eff;
}

.chart-bar.codex {
  background: #67c23a;
}

.chart-time {
  font-size: 10px;
  color: #909399;
  width: 80px;
  text-align: right;
}

.control-content {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .monitoring-dashboard {
    padding: 16px;
  }

  .overview-section {
    margin-bottom: 20px;
  }

  .overview-card {
    height: 140px;
  }

  .stat-number,
  .rt-number,
  .sr-number {
    font-size: 20px;
  }

  .chart-container {
    height: 180px;
  }

  .chart-bars {
    gap: 2px;
  }

  .chart-bar {
    width: 40px;
  }

  .chart-time {
    font-size: 9px;
    width: 60px;
  }
}
</style>