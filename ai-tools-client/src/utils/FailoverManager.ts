/**
 * 故障转移管理器
 * 负责供应商故障检测、自动切换和性能监控
 */

import type {
  Supplier,
  SupplierHealth,
  FailoverConfig
} from '@/types/supplier'
import { supplierApi } from '@/services/supplierApi'

/**
 * 故障转移决策结果
 */
export interface FailoverDecision {
  shouldFailover: boolean
  reason: string
  targetSupplierId?: number
  confidence: number // 0-100，决策置信度
}

/**
 * 性能分析结果
 */
export interface PerformanceAnalysis {
  averageResponseTime: number
  successRate: number
  uptimePercentage: number
  trend: 'improving' | 'stable' | 'degrading'
  recommendation: string
}

/**
 * 故障转移管理器类
 */
export class FailoverManager {
  private config: FailoverConfig
  private healthHistory: Map<number, SupplierHealth[]> = new Map()
  private readonly MAX_HISTORY_SIZE = 20

  constructor(config?: Partial<FailoverConfig>) {
    // 默认配置
    this.config = {
      enabled: true,
      triggerConditions: [],
      autoRollback: true,
      rollbackDelaySeconds: 300,
      maxConsecutiveFailures: 3,
      maxResponseTimeMs: 5000,
      minSuccessRate: 95.0,
      ...config
    }
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<FailoverConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取当前配置
   */
  getConfig(): FailoverConfig {
    return { ...this.config }
  }

  /**
   * 检查是否应该触发故障转移
   */
  async checkAndDecideFailover(
    supplierId: number,
    supplierType: 'claude' | 'codex'
  ): Promise<FailoverDecision> {
    // 如果故障转移未启用，直接返回
    if (!this.config.enabled) {
      return {
        shouldFailover: false,
        reason: '故障转移功能未启用',
        confidence: 0
      }
    }

    try {
      // 执行健康检查
      const health = await supplierApi.checkSupplierHealth(supplierId)

      // 记录健康历史
      this.recordHealthHistory(supplierId, health)

      // 分析是否需要故障转移
      const decision = this.analyzeFailoverNeed(health, supplierType)

      return decision
    } catch (error) {
      console.error('故障转移决策失败:', error)
      return {
        shouldFailover: true,
        reason: '健康检查失败，建议切换',
        confidence: 90
      }
    }
  }

  /**
   * 分析是否需要故障转移
   */
  private analyzeFailoverNeed(
    health: SupplierHealth,
    supplierType: 'claude' | 'codex'
  ): FailoverDecision {
    const reasons: string[] = []
    let confidence = 0

    // 检查1: 供应商健康状态
    if (!health.isHealthy) {
      reasons.push('供应商健康状态异常')
      confidence += 40
    }

    // 检查2: 连续失败次数
    if (health.consecutiveFailures >= this.config.maxConsecutiveFailures) {
      reasons.push(`连续失败${health.consecutiveFailures}次，超过阈值${this.config.maxConsecutiveFailures}`)
      confidence += 30
    }

    // 检查3: 响应时间
    if (health.responseTime > this.config.maxResponseTimeMs) {
      reasons.push(`响应时间${health.responseTime}ms超过阈值${this.config.maxResponseTimeMs}ms`)
      confidence += 20
    }

    // 检查4: 运行时间百分比
    if (health.uptimePercentage < 50) {
      reasons.push(`运行时间百分比过低: ${health.uptimePercentage.toFixed(1)}%`)
      confidence += 10
    }

    const shouldFailover = confidence >= 60

    return {
      shouldFailover,
      reason: shouldFailover
        ? reasons.join('; ')
        : '供应商运行正常，无需切换',
      confidence: Math.min(confidence, 100)
    }
  }

  /**
   * 选择最佳备用供应商
   */
  async findBestBackupSupplier(
    currentSupplierId: number,
    supplierType: 'claude' | 'codex'
  ): Promise<number | null> {
    try {
      // 获取所有同类型供应商
      const allSuppliers = await supplierApi.listSuppliers(supplierType)
      const candidates = allSuppliers.filter(
        (s: Supplier) => s.type === supplierType && s.id !== currentSupplierId
      )

      if (candidates.length === 0) {
        return null
      }

      // 批量检查健康状态
      const healthChecks = await Promise.all(
        candidates.map((s: Supplier) => supplierApi.checkSupplierHealth(s.id!))
      )

      // 筛选健康的供应商
      const healthyCandidates = candidates
        .map((supplier: Supplier, index: number) => ({
          supplier,
          health: healthChecks[index]
        }))
        .filter((item): item is { supplier: Supplier; health: SupplierHealth } => 
          item.health !== undefined && item.health.isHealthy
        )

      if (healthyCandidates.length === 0) {
        return null
      }

      // 按性能排序，选择最佳供应商
      healthyCandidates.sort((a, b) => {
        // 优先级1: 连续失败次数更少
        if (a.health.consecutiveFailures !== b.health.consecutiveFailures) {
          return a.health.consecutiveFailures - b.health.consecutiveFailures
        }

        // 优先级2: 响应时间更快
        if (a.health.responseTime !== b.health.responseTime) {
          return a.health.responseTime - b.health.responseTime
        }

        // 优先级3: 运行时间百分比更高
        return b.health.uptimePercentage - a.health.uptimePercentage
      })

      const bestCandidate = healthyCandidates[0]
      return bestCandidate ? bestCandidate.supplier.id! : null
    } catch (error) {
      console.error('查找备用供应商失败:', error)
      return null
    }
  }

  /**
   * 执行自动故障转移
   */
  async executeAutoFailover(
    fromSupplierId: number,
    toSupplierId: number,
    reason: string
  ): Promise<boolean> {
    try {
      const request = {
        fromSupplierId,
        toSupplierId,
        switchReason: 'auto_failover' as const,
        createBackup: true,
        rollbackOnFailure: this.config.autoRollback
      }
      const result = await supplierApi.switchSupplier(request)
      return result.success
    } catch (error) {
      console.error('执行自动故障转移失败:', error)
      return false
    }
  }

  /**
   * 记录健康历史
   */
  private recordHealthHistory(supplierId: number, health: SupplierHealth): void {
    let history = this.healthHistory.get(supplierId)
    if (!history) {
      history = []
      this.healthHistory.set(supplierId, history)
    }

    history.push(health)

    // 保持历史记录在合理范围内
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift()
    }
  }

  /**
   * 分析供应商性能趋势
   */
  analyzePerformanceTrend(supplierId: number): PerformanceAnalysis | null {
    const history = this.healthHistory.get(supplierId)
    if (!history || history.length < 3) {
      return null
    }

    // 计算平均响应时间
    const averageResponseTime =
      history.reduce((sum, h) => sum + h.responseTime, 0) / history.length

    // 计算成功率
    const totalRequests = history.reduce((sum, h) => sum + h.totalRequests, 0)
    const failedRequests = history.reduce((sum, h) => sum + h.failedRequests, 0)
    const successRate =
      totalRequests > 0 ? ((totalRequests - failedRequests) / totalRequests) * 100 : 100

    // 计算平均运行时间百分比
    const uptimePercentage =
      history.reduce((sum, h) => sum + h.uptimePercentage, 0) / history.length

    // 分析趋势（比较最近3次和之前3次的平均响应时间）
    let trend: 'improving' | 'stable' | 'degrading' = 'stable'
    if (history.length >= 6) {
      const recentAvg =
        history.slice(-3).reduce((sum, h) => sum + h.responseTime, 0) / 3
      const previousAvg =
        history.slice(-6, -3).reduce((sum, h) => sum + h.responseTime, 0) / 3

      if (recentAvg < previousAvg * 0.9) {
        trend = 'improving'
      } else if (recentAvg > previousAvg * 1.1) {
        trend = 'degrading'
      }
    }

    // 生成建议
    let recommendation = ''
    if (trend === 'degrading') {
      recommendation = '性能下降，建议检查供应商状态或考虑切换'
    } else if (trend === 'improving') {
      recommendation = '性能改善，供应商运行良好'
    } else {
      recommendation = '性能稳定，继续监控'
    }

    if (successRate < 90) {
      recommendation += '；成功率偏低，需要关注'
    }

    return {
      averageResponseTime: Math.round(averageResponseTime),
      successRate: Math.round(successRate * 100) / 100,
      uptimePercentage: Math.round(uptimePercentage * 100) / 100,
      trend,
      recommendation
    }
  }

  /**
   * 清除健康历史
   */
  clearHealthHistory(supplierId?: number): void {
    if (supplierId) {
      this.healthHistory.delete(supplierId)
    } else {
      this.healthHistory.clear()
    }
  }

  /**
   * 获取健康历史
   */
  getHealthHistory(supplierId: number): SupplierHealth[] {
    return this.healthHistory.get(supplierId) || []
  }

  /**
   * 验证故障转移配置
   */
  validateConfig(): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    if (this.config.maxConsecutiveFailures < 1) {
      errors.push('最大连续失败次数必须大于0')
    }

    if (this.config.maxResponseTimeMs < 100) {
      errors.push('最大响应时间必须至少100ms')
    }

    if (this.config.minSuccessRate < 0 || this.config.minSuccessRate > 100) {
      errors.push('最小成功率必须在0-100之间')
    }

    if (this.config.rollbackDelaySeconds < 10) {
      errors.push('回滚延迟必须至少10秒')
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

// 导出单例实例
export const failoverManager = new FailoverManager()

// 导出工厂函数
export function createFailoverManager(config?: Partial<FailoverConfig>): FailoverManager {
  return new FailoverManager(config)
}
