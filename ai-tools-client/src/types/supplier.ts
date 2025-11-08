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
