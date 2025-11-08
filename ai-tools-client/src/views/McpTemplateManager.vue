<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type {
  McpTemplate,
  CreateMcpTemplateRequest,
  UpdateMcpTemplateRequest,
  McpTemplateCategory
} from '@/types'
import { mcpTemplateApi } from '@/services/mcpTemplateApi'

// 响应式数据
const templates = ref<McpTemplate[]>([])
const categories = ref<McpTemplateCategory[]>([])
const loading = ref(false)
const dialogVisible = ref(false)
const configDialogVisible = ref(false)
const editingTemplate = ref<McpTemplate | null>(null)
const isEdit = ref(false)

// 筛选条件
const filters = ref({
  aiType: '',
  platformType: '',
  category: '',
  keyword: ''
})

// 表单数据
const formData = ref<CreateMcpTemplateRequest>({
  name: '',
  aiType: 'claude',
  platformType: 'unix',
  configContent: '',
  description: '',
  category: '',
  tags: []
})

// 配置编辑器数据
const configContent = ref('')
const configLanguage = ref('json')

// AI类型选项
const aiTypes = [
  { label: 'Claude', value: 'claude' },
  { label: 'Codex', value: 'codex' }
]

// 平台类型选项
const platformTypes = [
  { label: 'Unix/Linux', value: 'unix' },
  { label: 'Windows', value: 'windows' }
]

// 分类选项
const categoryOptions = [
  { label: '文档', value: 'documentation' },
  { label: '工具', value: 'tools' },
  { label: '测试', value: 'testing' },
  { label: '开发', value: 'development' },
  { label: '搜索', value: 'search' },
  { label: '知识', value: 'knowledge' },
  { label: '工作流', value: 'workflow' },
  { label: '生产力', value: 'productivity' }
]

// 计算属性
const dialogTitle = computed(() => isEdit.value ? '编辑MCP模板' : '新建MCP模板')
const filteredTemplates = computed(() => {
  return templates.value.filter(template => {
    if (filters.value.aiType && template.aiType !== filters.value.aiType) {
      return false
    }
    if (filters.value.platformType && template.platformType !== filters.value.platformType) {
      return false
    }
    if (filters.value.category && template.category !== filters.value.category) {
      return false
    }
    if (filters.value.keyword) {
      const keyword = filters.value.keyword.toLowerCase()
      return template.name.toLowerCase().includes(keyword) ||
             (template.description && template.description.toLowerCase().includes(keyword))
    }
    return true
  })
})

// 加载模板列表
const loadTemplates = async () => {
  loading.value = true
  try {
    templates.value = await mcpTemplateApi.listMcpTemplates()
  } catch (error) {
    ElMessage.error('加载MCP模板列表失败')
    console.error(error)
  } finally {
    loading.value = false
  }
}

// 加载分类列表
const loadCategories = async () => {
  try {
    categories.value = await mcpTemplateApi.getMcpTemplateCategories()
  } catch (error) {
    console.error('加载分类列表失败:', error)
  }
}

// 显示新建对话框
const showCreateDialog = () => {
  isEdit.value = false
  editingTemplate.value = null
  formData.value = {
    name: '',
    aiType: 'claude',
    platformType: 'unix',
    configContent: '',
    description: '',
    category: '',
    tags: []
  }
  dialogVisible.value = true
}

// 显示编辑对话框
const showEditDialog = (template: McpTemplate) => {
  isEdit.value = true
  editingTemplate.value = template
  formData.value = {
    name: template.name,
    aiType: template.aiType,
    platformType: template.platformType,
    configContent: template.configContent,
    description: template.description || '',
    category: template.category || '',
    tags: template.tags ? [...template.tags] : []
  }
  dialogVisible.value = true
}

// 显示配置编辑器
const showConfigEditor = (template: McpTemplate | null = null) => {
  editingTemplate.value = template
  if (template) {
    configContent.value = template.configContent
    configLanguage.value = template.aiType === 'claude' ? 'json' : 'toml'
  } else {
    configContent.value = ''
    configLanguage.value = 'json'
  }
  configDialogVisible.value = true
}

// 保存模板
const saveTemplate = async () => {
  try {
    // 验证配置格式
    const validation = mcpTemplateApi.validateConfigFormat(
      formData.value.configContent,
      formData.value.aiType
    )

    if (!validation.valid) {
      ElMessage.error(`配置格式错误: ${validation.error}`)
      return
    }

    if (isEdit.value && editingTemplate.value) {
      await mcpTemplateApi.updateMcpTemplate({
        ...formData.value,
        id: editingTemplate.value.id!
      })
      ElMessage.success('MCP模板更新成功')
    } else {
      await mcpTemplateApi.createMcpTemplate(formData.value)
      ElMessage.success('MCP模板创建成功')
    }

    dialogVisible.value = false
    await loadTemplates()
    await loadCategories()
  } catch (error) {
    ElMessage.error(isEdit.value ? 'MCP模板更新失败' : 'MCP模板创建失败')
    console.error(error)
  }
}

// 删除模板
const deleteTemplate = async (template: McpTemplate) => {
  if (template.isBuiltin) {
    ElMessage.warning('内置模板不允许删除')
    return
  }

  try {
    await ElMessageBox.confirm(
      `确定要删除模板 "${template.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    await mcpTemplateApi.deleteMcpTemplate(template.id!)
    ElMessage.success('MCP模板删除成功')
    await loadTemplates()
    await loadCategories()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('MCP模板删除失败')
      console.error(error)
    }
  }
}

// 克隆模板
const cloneTemplate = async (template: McpTemplate) => {
  try {
    const { value: newName } = await ElMessageBox.prompt(
      `请输入新模板名称`,
      '克隆模板',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        inputValue: `${template.name} - 副本`
      }
    )

    if (!newName) {
      return
    }

    const clonedTemplate = await mcpTemplateApi.cloneMcpTemplate(template.id!, newName)
    if (clonedTemplate) {
      ElMessage.success('模板克隆成功')
      await loadTemplates()
      await loadCategories()
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('模板克隆失败')
      console.error(error)
    }
  }
}

// 导出模板
const exportTemplates = async () => {
  try {
    const templatesToExport = await mcpTemplateApi.exportMcpTemplates()
    const dataStr = JSON.stringify(templatesToExport, null, 2)
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr)

    const exportFileDefaultName = `mcp-templates-${new Date().toISOString().split('T')[0]}.json`

    const linkElement = document.createElement('a')
    linkElement.setAttribute('href', dataUri)
    linkElement.setAttribute('download', exportFileDefaultName)
    linkElement.click()

    ElMessage.success('模板导出成功')
  } catch (error) {
    ElMessage.error('模板导出失败')
    console.error(error)
  }
}

// 导入模板
const importTemplates = () => {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json'
  input.onchange = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return

    try {
      const text = await file.text()
      const templatesToImport = JSON.parse(text) as CreateMcpTemplateRequest[]

      const importedTemplates = await mcpTemplateApi.importMcpTemplates(templatesToImport)
      ElMessage.success(`成功导入 ${importedTemplates.length} 个模板`)

      await loadTemplates()
      await loadCategories()
    } catch (error) {
      ElMessage.error('模板导入失败，请检查文件格式')
      console.error(error)
    }
  }
  input.click()
}

// 增加使用次数
const incrementUsage = async (template: McpTemplate) => {
  try {
    await mcpTemplateApi.incrementTemplateUsage(template.id!)
  } catch (error) {
    console.error('增加使用次数失败:', error)
  }
}

// 格式化配置内容
const formatConfigContent = () => {
  const formatted = mcpTemplateApi.formatConfigContent(
    configContent.value,
    editingTemplate.value?.aiType || 'claude'
  )
  configContent.value = formatted.content
  configLanguage.value = formatted.language
}

// 页面加载时获取数据
onMounted(() => {
  loadTemplates()
  loadCategories()
})
</script>

<template>
  <div class="mcp-template-manager">
    <div class="header">
      <h2>MCP模板管理</h2>
      <div class="actions">
        <el-button type="success" @click="importTemplates">
          <el-icon><Upload /></el-icon>
          导入模板
        </el-button>
        <el-button @click="exportTemplates">
          <el-icon><Download /></el-icon>
          导出模板
        </el-button>
        <el-button type="primary" @click="showCreateDialog">
          <el-icon><Plus /></el-icon>
          新建模板
        </el-button>
      </div>
    </div>

    <!-- 筛选器 -->
    <div class="filters">
      <el-row :gutter="16">
        <el-col :span="6">
          <el-select v-model="filters.aiType" placeholder="AI类型" clearable>
            <el-option label="全部" value="" />
            <el-option
              v-for="type in aiTypes"
              :key="type.value"
              :label="type.label"
              :value="type.value"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filters.platformType" placeholder="平台类型" clearable>
            <el-option label="全部" value="" />
            <el-option
              v-for="platform in platformTypes"
              :key="platform.value"
              :label="platform.label"
              :value="platform.value"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-select v-model="filters.category" placeholder="分类" clearable>
            <el-option label="全部" value="" />
            <el-option
              v-for="category in categoryOptions"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
        </el-col>
        <el-col :span="6">
          <el-input
            v-model="filters.keyword"
            placeholder="搜索模板名称或描述"
            clearable
          >
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </el-col>
      </el-row>
    </div>

    <!-- 模板列表 -->
    <div class="content">
      <el-table
        :data="filteredTemplates"
        v-loading="loading"
        stripe
        style="width: 100%"
      >
        <el-table-column prop="name" label="名称" min-width="150" />
        <el-table-column prop="version" label="版本" width="100" />
        <el-table-column prop="aiType" label="AI类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.aiType === 'claude' ? 'primary' : 'success'">
              {{ row.aiType.toUpperCase() }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="platformType" label="平台" width="100">
          <template #default="{ row }">
            <el-tag :type="row.platformType === 'unix' ? 'info' : 'warning'">
              {{ row.platformType === 'unix' ? 'Unix' : 'Windows' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="category" label="分类" width="120" />
        <el-table-column prop="isBuiltin" label="类型" width="80">
          <template #default="{ row }">
            <el-tag :type="row.isBuiltin ? 'info' : ''" size="small">
              {{ row.isBuiltin ? '内置' : '自定义' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="usageCount" label="使用次数" width="100" />
        <el-table-column prop="createdAt" label="创建时间" width="180">
          <template #default="{ row }">
            {{ row.createdAt ? new Date(row.createdAt).toLocaleString() : '-' }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="320" fixed="right">
          <template #default="{ row }">
            <el-button
              size="small"
              type="primary"
              link
              @click="showConfigEditor(row)"
            >
              配置
            </el-button>
            <el-button
              size="small"
              type="success"
              link
              @click="cloneTemplate(row)"
            >
              克隆
            </el-button>
            <el-button
              size="small"
              link
              @click="showEditDialog(row)"
              :disabled="row.isBuiltin"
            >
              编辑
            </el-button>
            <el-button
              size="small"
              type="danger"
              link
              @click="deleteTemplate(row)"
              :disabled="row.isBuiltin"
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
      width="700px"
    >
      <el-form
        :model="formData"
        label-width="80px"
        @submit.prevent
      >
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="名称" required>
              <el-input
                v-model="formData.name"
                placeholder="请输入模板名称"
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="版本">
              <el-input
                v-model="formData.version"
                placeholder="默认1.0.0"
                disabled
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="AI类型" required>
              <el-select v-model="formData.aiType" placeholder="请选择AI类型">
                <el-option
                  v-for="type in aiTypes"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="平台类型" required>
              <el-select v-model="formData.platformType" placeholder="请选择平台类型">
                <el-option
                  v-for="platform in platformTypes"
                  :key="platform.value"
                  :label="platform.label"
                  :value="platform.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="分类">
          <el-select v-model="formData.category" placeholder="请选择分类" clearable>
            <el-option
              v-for="category in categoryOptions"
              :key="category.value"
              :label="category.label"
              :value="category.value"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="描述">
          <el-input
            v-model="formData.description"
            type="textarea"
            :rows="3"
            placeholder="请输入模板描述"
          />
        </el-form-item>

        <el-form-item label="配置内容" required>
          <el-input
            v-model="formData.configContent"
            type="textarea"
            :rows="8"
            placeholder="请输入JSON或TOML格式的配置内容"
          />
          <div class="config-hint">
            <el-text size="small" type="info">
              {{ formData.aiType === 'claude' ? '请输入JSON格式的配置' : '请输入TOML格式的配置' }}
            </el-text>
          </div>
        </el-form-item>

        <el-form-item label="标签">
          <el-input
            v-model="formData.tags"
            placeholder="请输入标签，用逗号分隔"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="saveTemplate">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>

    <!-- 配置编辑器对话框 -->
    <el-dialog
      v-model="configDialogVisible"
      title="配置编辑器"
      width="800px"
    >
      <div class="config-editor">
        <div class="editor-header">
          <span>
            模板: {{ editingTemplate?.name || '新模板' }}
            ({{ editingTemplate?.aiType?.toUpperCase() || 'CLAUDE' }})
          </span>
          <el-button size="small" @click="formatConfigContent">
            格式化
          </el-button>
        </div>
        <el-input
          v-model="configContent"
          type="textarea"
          :rows="20"
          placeholder="请输入配置内容"
        />
      </div>

      <template #footer>
        <span class="dialog-footer">
          <el-button @click="configDialogVisible = false">关闭</el-button>
          <el-button type="primary" @click="configDialogVisible = false">
            确定
          </el-button>
        </span>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.mcp-template-manager {
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

.filters {
  margin-bottom: 20px;
  padding: 16px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

.config-editor {
  margin-bottom: 16px;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 500;
}

.config-hint {
  margin-top: 4px;
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

:deep(.el-textarea__inner) {
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
}
</style>