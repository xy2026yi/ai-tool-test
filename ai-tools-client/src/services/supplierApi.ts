import type {
  Supplier,
  CreateSupplierRequest,
  UpdateSupplierRequest,
  ConnectionTestResult,
  ApiResponse
} from '@/types'
import '@/types/tauri'

class SupplierApiService {
  // 获取供应商列表
  async listSuppliers(type?: string): Promise<Supplier[]> {
    try {
      const result = await window.__TAURI__.invoke('list_suppliers', {
        supplierType: type
      })
      return result.data || []
    } catch (error) {
      console.error('获取供应商列表失败:', error)
      throw error
    }
  }

  // 创建供应商
  async createSupplier(request: CreateSupplierRequest): Promise<Supplier> {
    try {
      const result = await window.__TAURI__.invoke('create_supplier', request)
      if (result.success) {
        return result.data
      } else {
        throw new Error(result.message || '创建供应商失败')
      }
    } catch (error) {
      console.error('创建供应商失败:', error)
      throw error
    }
  }

  // 更新供应商
  async updateSupplier(request: UpdateSupplierRequest): Promise<Supplier> {
    try {
      const result = await window.__TAURI__.invoke('update_supplier', request)
      if (result.success) {
        return result.data
      } else {
        throw new Error(result.message || '更新供应商失败')
      }
    } catch (error) {
      console.error('更新供应商失败:', error)
      throw error
    }
  }

  // 删除供应商
  async deleteSupplier(id: number): Promise<boolean> {
    try {
      const result = await window.__TAURI__.invoke('delete_supplier', { id })
      return result.success && result.data
    } catch (error) {
      console.error('删除供应商失败:', error)
      throw error
    }
  }

  // 根据ID获取供应商
  async getSupplierById(id: number): Promise<Supplier | null> {
    try {
      const result = await window.__TAURI__.invoke('get_supplier_by_id', { id })
      return result.data || null
    } catch (error) {
      console.error('获取供应商失败:', error)
      throw error
    }
  }

  // 设置活跃供应商
  async setActiveSupplier(id: number, type: string): Promise<boolean> {
    try {
      const result = await window.__TAURI__.invoke('set_active_supplier', {
        id,
        type
      })
      return result.success && result.data
    } catch (error) {
      console.error('设置活跃供应商失败:', error)
      throw error
    }
  }

  // 测试供应商连接
  async testConnection(supplier: Supplier): Promise<ConnectionTestResult> {
    try {
      const result = await window.__TAURI__.invoke('test_supplier_connection', {
        supplier
      })
      if (result.success) {
        return result.data
      } else {
        throw new Error(result.message || '连接测试失败')
      }
    } catch (error) {
      console.error('连接测试失败:', error)
      throw error
    }
  }

  // 验证供应商配置
  async validateConfig(supplier: Supplier): Promise<boolean> {
    try {
      const result = await window.__TAURI__.invoke('validate_supplier_config', {
        supplier
      })
      return result.success && result.data
    } catch (error) {
      console.error('配置验证失败:', error)
      throw error
    }
  }

  // 获取供应商统计
  async getSupplierStats(): Promise<any> {
    try {
      const result = await window.__TAURI__.invoke('get_supplier_stats')
      return result.data
    } catch (error) {
      console.error('获取供应商统计失败:', error)
      throw error
    }
  }

  // 导入供应商
  async importSuppliers(suppliers: CreateSupplierRequest[]): Promise<Supplier[]> {
    try {
      const result = await window.__TAURI__.invoke('import_suppliers', {
        suppliers
      })
      if (result.success) {
        return result.data
      } else {
        throw new Error(result.message || '导入供应商失败')
      }
    } catch (error) {
      console.error('导入供应商失败:', error)
      throw error
    }
  }

  // 导出供应商
  async exportSuppliers(): Promise<Supplier[]> {
    try {
      const result = await window.__TAURI__.invoke('export_suppliers')
      return result.data || []
    } catch (error) {
      console.error('导出供应商失败:', error)
      throw error
    }
  }
}

export const supplierApi = new SupplierApiService()