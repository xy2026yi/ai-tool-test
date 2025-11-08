<script setup lang="ts">
import { ref } from 'vue'
import { ElDialog, ElCollapse, ElCollapseItem, ElButton, ElIcon } from 'element-plus'
import { QuestionFilled } from '@element-plus/icons-vue'

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const activeNames = ref(['1'])

const faqItems = [
  {
    title: '如何添加新的AI供应商？',
    content: '进入"供应商管理"页面，点击"添加供应商"按钮，填写供应商信息后保存即可。'
  },
  {
    title: '如何切换工作模式？',
    content: '进入"模式管理"页面，选择所需的工作模式（Claude优先、Codex优先或混合模式），点击"应用模式"即可。'
  },
  {
    title: '什么是MCP模板？',
    content: 'MCP（Model Context Protocol）模板是用于配置AI工具的标准化配置文件，支持JSON和TOML格式。'
  },
  {
    title: '如何备份配置文件？',
    content: '进入"配置管理"页面，点击"备份配置"按钮，系统会自动创建当前配置的备份。'
  },
  {
    title: '供应商健康检查的作用？',
    content: '健康检查会定期测试供应商的可用性和响应时间，当检测到故障时可自动切换到备用供应商。'
  }
]

const features = [
  {
    title: '供应商管理',
    description: '管理Claude和Codex等AI工具供应商，支持测试连接、导入导出配置'
  },
  {
    title: 'MCP模板管理',
    description: '管理和编辑MCP服务器配置模板，支持多种预定义模板'
  },
  {
    title: '工作模式切换',
    description: '在不同工作模式间快速切换，自动更新配置文件'
  },
  {
    title: '供应商切换',
    description: '智能供应商切换，支持自动故障转移和性能监控'
  },
  {
    title: '配置文件管理',
    description: '统一管理配置文件，支持备份、恢复和预览功能'
  }
]

const shortcuts = [
  { key: 'Ctrl/Cmd + S', description: '保存当前表单' },
  { key: 'Ctrl/Cmd + K', description: '快速搜索' },
  { key: 'Esc', description: '关闭对话框' },
  { key: 'F1', description: '打开帮助中心' }
]

const handleClose = () => {
  emit('update:visible', false)
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    @update:model-value="handleClose"
    title="帮助中心"
    width="800px"
    :close-on-click-modal="false"
  >
    <div class="help-content">
      <!-- 常见问题 -->
      <div class="help-section">
        <h3>
          <el-icon><QuestionFilled /></el-icon>
          常见问题
        </h3>
        <el-collapse v-model="activeNames">
          <el-collapse-item
            v-for="(item, index) in faqItems"
            :key="index"
            :name="String(index + 1)"
            :title="item.title"
          >
            <p>{{ item.content }}</p>
          </el-collapse-item>
        </el-collapse>
      </div>

      <!-- 功能说明 -->
      <div class="help-section">
        <h3>功能说明</h3>
        <div class="feature-list">
          <div
            v-for="(feature, index) in features"
            :key="index"
            class="feature-item"
          >
            <h4>{{ feature.title }}</h4>
            <p>{{ feature.description }}</p>
          </div>
        </div>
      </div>

      <!-- 快捷键 -->
      <div class="help-section">
        <h3>快捷键</h3>
        <div class="shortcut-list">
          <div
            v-for="(shortcut, index) in shortcuts"
            :key="index"
            class="shortcut-item"
          >
            <kbd>{{ shortcut.key }}</kbd>
            <span>{{ shortcut.description }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <el-button @click="handleClose">关闭</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.help-content {
  max-height: 600px;
  overflow-y: auto;
}

.help-section {
  margin-bottom: 30px;
}

.help-section h3 {
  margin-bottom: 16px;
  font-size: 18px;
  font-weight: 600;
  color: var(--color-text);
  display: flex;
  align-items: center;
  gap: 8px;
}

.feature-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
  gap: 16px;
}

.feature-item {
  padding: 16px;
  background-color: var(--color-background-soft);
  border-radius: 8px;
  border: 1px solid var(--color-border);
}

.feature-item h4 {
  margin: 0 0 8px 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--color-text);
}

.feature-item p {
  margin: 0;
  font-size: 14px;
  color: var(--color-text-secondary);
}

.shortcut-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.shortcut-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.shortcut-item kbd {
  display: inline-block;
  padding: 4px 8px;
  min-width: 120px;
  font-family: monospace;
  font-size: 13px;
  background-color: var(--color-background-mute);
  border: 1px solid var(--color-border);
  border-radius: 4px;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.shortcut-item span {
  font-size: 14px;
  color: var(--color-text-secondary);
}

@media (max-width: 767px) {
  .feature-list {
    grid-template-columns: 1fr;
  }
}
</style>
