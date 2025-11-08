import type { AiType, PlatformType } from './index'

// MCP模板配置
export interface McpTemplateConfig {
  name: string
  type: 'stdio' | 'websocket'
  command?: string
  args?: string[]
  env?: Record<string, string>
  startupTimeoutMs?: number
  url?: string // for websocket type
}

// MCP模板
export interface McpTemplate {
  id?: number
  name: string
  version: string
  aiType: AiType
  platformType: PlatformType
  configContent: string // JSON or TOML string
  description?: string
  isBuiltin?: boolean
  category?: string
  tags?: string[]
  usageCount?: number
  createdAt?: string
  updatedAt?: string
}

// 创建MCP模板请求
export interface CreateMcpTemplateRequest {
  name: string
  aiType: AiType
  platformType: PlatformType
  configContent: string
  description?: string
  category?: string
  tags?: string[]
}

// 更新MCP模板请求
export interface UpdateMcpTemplateRequest extends Partial<CreateMcpTemplateRequest> {
  id: number
}

// MCP模板验证结果
export interface McpTemplateValidationResult {
  valid: boolean
  errors?: string[]
  warnings?: string[]
}

// MCP模板分类
export interface McpTemplateCategory {
  name: string
  count: number
  description?: string
}
