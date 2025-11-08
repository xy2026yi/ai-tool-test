<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Supplier, CreateSupplierRequest, UpdateSupplierRequest } from '@/types'
import { supplierApi } from '@/services/supplierApi'

// 响应式数据
const suppliers = ref<Supplier[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const editingSupplier = ref<Supplier | null>(null)
const isEdit = ref(false)

// 表单数据
const formData = ref<CreateSupplierRequest>({
  name: '',
  type: 'claude',
  baseUrl: '',
  authToken: ''
})

// 供应商类型选项
const supplierTypes = [
  { label: 'Claude', value: 'claude' },
  { label: 'Codex', value: 'codex' }
]

// 计算属性
const dialogTitle = computed(() => isEdit.value ? '编辑供应商' : '新建供应商')

// 加载供应商列表
const loadSuppliers = async () => {
  loading.value = true
  try {
    suppliers.value = await supplierApi.listSuppliers()
  } catch (error) {
    ElMessage.error('加载供应商列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 显示新建对话框
const showCreateDialog = () => {
  isEdit.value = false
  editingSupplier.value = null
  formData.value = {
    name: '',
    type: 'claude',
    baseUrl: '',
    authToken: ''
  }
  dialogVisible.value = true
}

// 显示编辑对话框
const showEditDialog = (supplier: Supplier) => {
  isEdit.value = true
  editingSupplier.value = supplier
  formData.value = {
    name: supplier.name,
    type: supplier.type,
    baseUrl: supplier.baseUrl,
    authToken: supplier.authToken
  }
  dialogVisible.value = true
}

// 保存供应商
const saveSupplier = async () => {
  try {
    if (isEdit.value && editingSupplier.value) {
      await supplierApi.updateSupplier({
        ...formData.value,
        id: editingSupplier.value.id!
      })
      ElMessage.success('供应商更新成功')
    } else {
      await supplierApi.createSupplier(formData.value)
      ElMessage.success('供应商创建成功')
    }

    dialogVisible.value = false
    await loadSuppliers()
  } catch (error) {
    ElMessage.error(isEdit.value ? '供应商更新失败' : '供应商创建失败')
    console.error(error)
  }
}

// 删除供应商
const deleteSupplier = async (supplier: Supplier) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除供应商 "${supplier.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await supplierApi.deleteSupplier(supplier.id!)
    ElMessage.success('供应商删除成功')
    await loadSuppliers()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('供应商删除失败')
      console.error(error)
    }
  }
}

// 测试连接
const testConnection = async (supplier: Supplier) => {
  try {
    const result = await supplierApi.testConnection(supplier)
    if (result.success) {
      ElMessage.success(`连接成功！响应时间：${result.responseTime}ms`)
    } else {
      ElMessage.error(`连接失败：${result.error}`)
    }
  } catch (error) {
    ElMessage.error('连接测试失败')
    console.error(error)
  }
}

// 验证配置
const validateConfig = async (supplier: Supplier) => {
  try {
    const isValid = await supplierApi.validateConfig(supplier)
    if (isValid) {
      ElMessage.success('配置验证通过')
    } else {
      ElMessage.error('配置验证失败')
    }
  } catch (error) {
    ElMessage.error('配置验证出错')
    console.error(error)
  }
}

// 设置为活跃供应商
const setActiveSupplier = async (supplier: Supplier) => {
  try {
    await supplierApi.setActiveSupplier(supplier.id!, supplier.type)
    ElMessage.success(`已设置 ${supplier.name} 为活跃供应商`)
    await loadSuppliers()
  } catch (error) {
    ElMessage.error('设置活跃供应商失败')
    console.error(error)
  }
}

// 页面加载时获取数据
onMounted(() => {
  loadSuppliers()
})
</script>

<template>
  <div class="supplier-manager">
    <div class="header">
      <h2>供应商管理</h2>
      <div class="actions">
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          新建供应商
        </el-button>
      </div>
    </div>

    <div class="content">
      <el-table
        :data="suppliers"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="名称" min-width="120" />
        <el-table-column prop="type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'claude' ? 'primary' : 'success'">
              {{ row.type.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="baseUrl" label="基础URL" min-width="200" show-overflow-tooltip />
        <el-table-column prop="isActive" label="状态" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isActive ? 'success' : 'info'">
              {{ row.isActive ? '活跃' : '非活跃' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="300" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              @click="testConnection(row)"
            >
              测试连接
            </el-button>
            <el-button
              size="small"
              type="success"
              link
              @click="validateConfig(row)"
            >
              验证配置
            </el-button>
            <el-button
              size="small"
              type="warning"
              link
              @click="setActiveSupplier(row)"
              :disabled="row.isActive"
            >
              设为活跃
            </el-button>
            <el-button
              size="small"
              link
              @click="showEditDialog(row)"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              link
              @click="deleteSupplier(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- 新建/编辑对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="dialogTitle"
      width="500px"
    >
      <el-form
        :model="formData"
        label-width="80px"
        @submit.prevent
      >
        <el-form-item label="名称" required>
          <el-input
            v-model="formData.name"
            placeholder="请输入供应商名称"
          />
        </el-form-item>

        <el-form-item label="类型" required>
          <el-select v-model="formData.type" placeholder="请选择供应商类型">
            <el-option
              v-for="type in supplierTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="基础URL" required>
          <el-input
            v-model="formData.baseUrl"
            placeholder="请输入API基础URL"
          />
        </el-form-item>

        <el-form-item label="认证令牌" required>
          <el-input
            v-model="formData.authToken"
            type="password"
            placeholder="请输入认证令牌"
            show-password
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveSupplier">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.supplier-manager {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.header h2 {
  margin: 0;
  color: #333;
}

.content {
  flex: 1;
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.dialog-footer {
  text-align: right;
}

/* 表格样式优化 */
:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th) {
  background-color: #f5f7fa;
  color: #606266;
  font-weight: 600;
}

:deep(.el-table td) {
  padding: 12px 0;
}

/* 表单样式优化 */
:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  border-radius: 6px;
}

:deep(.el-select .el-input__wrapper) {
  border-radius: 6px;
}
</style>