// Tauri 命令类型定义
export interface TauriCommands {
  // 供应商相关命令
  list_suppliers: (params?: { supplierType?: string }) => Promise<any>
  create_supplier: (params: any) => Promise<any>
  update_supplier: (params: any) => Promise<any>
  delete_supplier: (params: { id: number }) => Promise<any>
  get_supplier_by_id: (params: { id: number }) => Promise<any>
  set_active_supplier: (params: { id: number; type: string }) => Promise<any>
  test_supplier_connection: (params: { supplier: any }) => Promise<any>
  validate_supplier_config: (params: { supplier: any }) => Promise<any>
  get_supplier_stats: () => Promise<any>
  import_suppliers: (params: { suppliers: any[] }) => Promise<any>
  export_suppliers: () => Promise<any>

  // MCP模板相关命令
  list_mcp_templates: (params?: { aiType?: string; platformType?: string }) => Promise<any>
  create_mcp_template: (params: any) => Promise<any>
  update_mcp_template: (params: any) => Promise<any>
  delete_mcp_template: (params: { id: number }) => Promise<any>
  get_mcp_template_by_id: (params: { id: number }) => Promise<any>
  validate_mcp_template: (params: any) => Promise<any>
  get_mcp_template_categories: () => Promise<any>
  increment_template_usage: (params: { id: number }) => Promise<any>
  clone_mcp_template: (params: { id: number; newName: string }) => Promise<any>
  get_mcp_template_stats: () => Promise<any>
  import_mcp_templates: (params: { templates: any[] }) => Promise<any>
  export_mcp_templates: () => Promise<any>

  // 配置相关命令
  backup_config: (params: {
    configType: string
    configPath: string
    content: string
    description?: string
  }) => Promise<any>
  get_config_history: (params: { configType: string; limit?: number }) => Promise<any>
  get_latest_config_backup: (params: { configType: string }) => Promise<any>
  restore_config_from_backup: (params: { backupId: number }) => Promise<any>
  cleanup_old_config_history: (params: { configType: string; keepCount: number }) => Promise<any>
  delete_config_history: (params: { backupId: number }) => Promise<any>

  // 工作模式相关命令
  get_work_mode_config: (params: { modeName: string }) => Promise<any>
  get_all_work_mode_configs: () => Promise<any>
  update_work_mode_config: (params: any) => Promise<any>

  // 应用状态相关命令
  get_app_state: (params: { key: string }) => Promise<any>
  set_app_state: (params: { key: string; value: string }) => Promise<any>
  get_current_mode: () => Promise<any>
  get_all_app_states: () => Promise<any>

  // 数据库相关命令
  get_database_stats: () => Promise<any>
  test_database_connection: () => Promise<any>
  export_all_data: () => Promise<any>
}

declare global {
  interface Window {
    __TAURI__: {
      invoke: <K extends keyof TauriCommands>(
        command: K,
        args?: TauriCommands[K] extends (params: infer P) => Promise<any>
          ? P
          : never
      ) => Promise<ReturnType<TauriCommands[K]>>
    }
  }
}