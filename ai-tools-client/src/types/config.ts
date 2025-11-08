import type { WorkMode } from './index'

// 配置文件类型
export type ConfigType = 'claude' | 'codex' | 'settings' | 'auth'

// 配置备份信息
export interface ConfigBackup {
  id: number
  configType: ConfigType
  configPath: string
  backupContent: string
  operationType: 'backup' | 'update' | 'restore'
  operationTime: string
  description?: string
}

// Claude配置结构
export interface ClaudeConfig {
  numStartups?: number
  installMethod?: 'global' | 'local'
  autoUpdates?: boolean
  tipsHistory?: Record<string, number>
  cachedStatsigGates?: Record<string, boolean>
  cachedDynamicConfigs?: Record<string, unknown>
  firstStartTime?: string
  userID?: string
  sonnet45MigrationComplete?: boolean
  changelogLastFetched?: number
  iterm2SetupInProgress?: boolean
  iterm2BackupPath?: string
  shiftEnterKeyBindingInstalled?: boolean
  hasCompletedOnboarding?: boolean
  lastOnboardingVersion?: string
  hasOpusPlanDefault?: boolean
  lastReleaseNotesSeen?: string
  projects?: Record<string, unknown>
  mcpServers?: Record<string, ClaudeMcpServer>
  env?: Record<string, string>
}

export interface ClaudeMcpServer {
  type: 'stdio' | 'websocket'
  command?: string
  args?: string[]
  env?: Record<string, string>
}

// Codex配置结构
export interface CodexConfig {
  model?: string
  modelReasoningEffort?: 'low' | 'medium' | 'high'
  disableResponseStorage?: boolean
  preferredAuthMethod?: 'apikey' | 'bearer'
  windowsWslSetupAcknowledged?: boolean
  modelProvider?: string
  modelProviders?: Record<string, CodexModelProvider>
  mcpServers?: Record<string, CodexMcpServer>
}

export interface CodexModelProvider {
  name: string
  baseUrl: string
  wireApi?: 'responses' | 'chat'
  requiresOpenaiAuth?: boolean
}

export interface CodexMcpServer {
  type: 'stdio' | 'websocket'
  command?: string
  args?: string[]
  env?: Record<string, string>
  startupTimeoutMs?: number
}

// 工作模式状态
export interface WorkModeState {
  currentMode: WorkMode
  previousMode?: WorkMode
  isTransitioning: boolean
  activeClaudeSupplier?: number
  activeCodexSupplier?: number
  activeMcpTemplates: number[]
}

// 配置更新请求
export interface UpdateConfigRequest {
  configType: ConfigType
  content: string
  createBackup?: boolean
  description?: string
}

// 配置差异对比结果
export interface ConfigDiffResult {
  hasChanges: boolean
  additions: string[]
  removals: string[]
  modifications: Array<{
    line: number
    old: string
    new: string
  }>
}
