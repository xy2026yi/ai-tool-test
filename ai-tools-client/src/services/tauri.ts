import type { ApiResponse } from '@/types'

// 临时Tauri API 模拟，直到Tauri环境可用
const mockInvoke = async <T>(command: string, args?: Record<string, unknown>): Promise<ApiResponse<T>> => {
  console.log(`Mock Tauri command: ${command}`, args)
  return {
    success: true,
    data: undefined as T,
    message: undefined,
  }
}

// Tauri API 封装
export class TauriService {
  /**
   * 调用 Tauri 命令
   */
  static async invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
    try {
      // 在Web环境中使用模拟API
      let response: ApiResponse<T>

      if (typeof window !== 'undefined' && window.__TAURI__) {
        // 真正的Tauri环境 - 暂时也使用模拟
        response = await mockInvoke<T>(command, args)
      } else {
        // Web开发环境
        response = await mockInvoke<T>(command, args)
      }

      if (response.success && response.data !== undefined) {
        return response.data
      } else {
        throw new Error(response.message || '操作失败')
      }
    } catch (error) {
      console.error(`Tauri command ${command} failed:`, error)
      throw error
    }
  }

  /**
   * 调用带参数的 Tauri 命令
   */
  static async invokeWithParams<T>(command: string, params: Record<string, unknown>): Promise<T> {
    return this.invoke<T>(command, params)
  }
}

// 便捷方法
export const invokeTauri = <T>(command: string, args?: Record<string, unknown>): Promise<T> => {
  return TauriService.invoke<T>(command, args)
}
