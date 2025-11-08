import type { AiType } from './index'

// Claude供应商配置
export interface ClaudeSupplierConfig {
  timeoutMs?: number
  autoUpdate?: boolean
  opusModel?: string
  sonnetModel?: string
  haikuModel?: string
}

// Codex供应商配置
export interface CodexSupplierConfig {
  // Codex供应商暂时没有额外配置字段
  [key: string]: unknown
}

// 供应商基础信息
export interface BaseSupplier {
  id?: number
  name: string
  baseUrl: string
  authToken: string
  type: AiType
  isActive?: boolean
  sortOrder?: number
  // 健康检查相关字段
  isHealthy?: boolean
  lastCheckTime?: string
  responseTime?: number
  consecutiveFailures?: number
  uptimePercentage?: number
  totalRequests?: number
  failedRequests?: number
  createdAt?: string
  updatedAt?: string
}

// Claude供应商
export interface ClaudeSupplier extends BaseSupplier {
  type: 'claude'
  claudeConfig?: ClaudeSupplierConfig
}

// Codex供应商
export interface CodexSupplier extends BaseSupplier {
  type: 'codex'
  codexConfig?: CodexSupplierConfig
}

// 联合类型
export type Supplier = ClaudeSupplier | CodexSupplier

// 创建供应商请求
export interface CreateSupplierRequest {
  name: string
  type: AiType
  baseUrl: string
  authToken: string
  claudeConfig?: ClaudeSupplierConfig
}

// 更新供应商请求
export interface UpdateSupplierRequest extends Partial<CreateSupplierRequest> {
  id: number
}

// 供应商连接测试结果
export interface ConnectionTestResult {
  success: boolean
  responseTime?: number
  error?: string
}

// 供应商健康状态
export interface SupplierHealth {
  supplierId: number
  isHealthy: boolean
  lastCheckTime: string
  responseTime: number
  consecutiveFailures: number
  uptimePercentage: number
  totalRequests: number
  failedRequests: number
  status: 'healthy' | 'degraded' | 'unhealthy'
  errorMessage?: string
}

// 供应商切换进度
export interface SupplierSwitchProgress {
  totalSteps: number
  completedSteps: number
  overallProgress: number // 0-100
  currentStep: string
  fromSupplier: number
  toSupplier: number
  startTime: string
  estimatedCompletion?: string
  rollbackAvailable: boolean
  isCompleted: boolean
  hasError: boolean
  errorMessage?: string
}

// 故障转移配置
export interface FailoverConfig {
  enabled: boolean
  triggerConditions: FailoverTrigger[]
  autoRollback: boolean
  rollbackDelaySeconds: number
  maxConsecutiveFailures: number
  maxResponseTimeMs: number
  minSuccessRate: number
}

// 故障转移触发条件
export interface FailoverTrigger {
  conditionType: 'consecutive_failures' | 'response_time' | 'success_rate'
  threshold: number
  evaluationWindowMinutes: number
}

// 供应商切换请求
export interface SupplierSwitchRequest {
  fromSupplierId: number
  toSupplierId: number
  switchReason: 'manual' | 'auto_failover' | 'health_check'
  createBackup: boolean
  rollbackOnFailure: boolean
}

// 供应商切换结果
export interface SupplierSwitchResult {
  success: boolean
  message: string
  fromSupplierId: number
  toSupplierId: number
  switchTime: string
  rollbackAvailable: boolean
  backupId?: number
  error?: string
}

// 供应商性能指标
export interface SupplierPerformanceMetrics {
  supplierId: number
  avgResponseTime: number
  successRate: number
  errorCount: number
  uptime: number
  totalRequests: number
  lastHour: {
    requests: number
    errors: number
    avgResponseTime: number
  }
}

// 供应商切换历史记录
export interface SupplierSwitchHistory {
  id: string
  operation: 'switch' | 'failover' | 'rollback'
  fromSupplierId: number
  toSupplierId: number
  reason: string
  timestamp: string
  success: boolean
  duration?: number
  backupId?: number
  error?: string
}
