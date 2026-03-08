<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast } from '@/components'
import { weightedSearch } from '@/utils'
import { AiModelEditor } from './components'
import { useZtoolsSubInput } from '@/composables'

const { success, error, confirm } = useToast()

interface AiModel {
  id: string
  label: string
  apiUrl: string
  apiKey: string
  description?: string
  icon?: string
  cost?: number
}

// 模型列表
const models = ref<AiModel[]>([])
const isDeleting = ref(false)
const loading = ref(true)

const { value: searchQuery } = useZtoolsSubInput('', '搜索 AI 模型...')

const filteredModels = computed(() =>
  weightedSearch(models.value, searchQuery.value || '', [
    { value: (m) => m.label || '', weight: 10 },
    { value: (m) => m.apiUrl || '', weight: 5 },
    { value: (m) => m.description || '', weight: 3 }
  ])
)

// 编辑器状态
const showEditor = ref(false)
const editingModel = ref<AiModel | null>(null)

// 加载模型列表
async function loadModels(): Promise<void> {
  try {
    const result = await window.ztools.internal.aiModels.getAll()
    if (result.success && result.data) {
      models.value = result.data
    }
  } catch (err) {
    console.error('加载 AI 模型列表失败:', err)
    error('加载模型列表失败')
  } finally {
    loading.value = false
  }
}

// 显示添加编辑器
function showAddEditor(): void {
  editingModel.value = null
  showEditor.value = true
}

// 显示编辑编辑器
function handleEdit(model: AiModel): void {
  editingModel.value = model
  showEditor.value = true
}

// 关闭编辑器
function closeEditor(): void {
  showEditor.value = false
  editingModel.value = null
}

// 保存模型
async function handleSave(model: AiModel): Promise<void> {
  // 验证必填字段
  if (!model.id || !model.label || !model.apiUrl || !model.apiKey) {
    error('请填写所有必填字段')
    return
  }

  try {
    // 创建纯对象副本，避免 IPC 序列化问题
    const modelData = {
      id: model.id,
      label: model.label,
      apiUrl: model.apiUrl,
      apiKey: model.apiKey,
      description: model.description || '',
      icon: model.icon,
      cost: model.cost
    }

    if (editingModel.value) {
      // 更新模型
      const result = await window.ztools.internal.aiModels.update(modelData)
      if (result.success) {
        success('模型更新成功')
        await loadModels()
        closeEditor()
      } else {
        error(result.error || '更新失败')
      }
    } else {
      // 添加模型
      const result = await window.ztools.internal.aiModels.add(modelData)
      if (result.success) {
        success('模型添加成功')
        await loadModels()
        closeEditor()
      } else {
        error(result.error || '添加失败')
      }
    }
  } catch (err) {
    console.error('保存模型失败:', err)
    error('保存失败')
  }
}

// 删除模型
async function handleDelete(modelId: string): Promise<void> {
  const confirmed = await confirm({
    message: '确定要删除这个模型吗？',
    title: '删除确认',
    type: 'warning'
  })
  if (!confirmed) {
    return
  }

  isDeleting.value = true
  try {
    const result = await window.ztools.internal.aiModels.delete(modelId)
    if (result.success) {
      success('模型删除成功')
      await loadModels()
    } else {
      error(result.error || '删除失败')
    }
  } catch (err) {
    console.error('删除模型失败:', err)
    error('删除失败')
  } finally {
    isDeleting.value = false
  }
}

// 隐藏 API 密钥
function maskApiKey(apiKey: string): string {
  if (!apiKey) return ''
  if (apiKey.length <= 8) return '********'
  return apiKey.substring(0, 4) + '****' + apiKey.substring(apiKey.length - 4)
}

onMounted(() => {
  loadModels()
})
</script>
<template>
  <div class="content-panel">
    <!-- 可滚动内容区 -->
    <Transition name="list-slide">
      <div v-show="!showEditor" class="scrollable-content">
        <!-- 顶部添加按钮 -->
        <div class="panel-header">
          <button class="btn" @click="showAddEditor">添加模型</button>
        </div>

        <!-- 模型列表 -->
        <div class="model-list">
          <div v-for="model in filteredModels" :key="model.id" class="card model-item">
            <div class="model-info">
              <div class="model-header">
                <h3 class="model-name">{{ model.label }}</h3>
                <span class="model-id">{{ model.id }}</span>
              </div>
              <div class="model-details">
                <div class="model-detail-item">
                  <span class="detail-label">API 地址：</span>
                  <span class="detail-value">{{ model.apiUrl }}</span>
                </div>
                <div class="model-detail-item">
                  <span class="detail-label">API 密钥：</span>
                  <span class="detail-value">{{ maskApiKey(model.apiKey) }}</span>
                </div>
                <div v-if="model.description" class="model-detail-item">
                  <span class="detail-label">描述：</span>
                  <span class="detail-value">{{ model.description }}</span>
                </div>
              </div>
            </div>

            <div class="model-actions">
              <button
                class="icon-btn edit-btn"
                title="编辑"
                :disabled="isDeleting"
                @click="handleEdit(model)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button
                class="icon-btn delete-btn"
                title="删除"
                :disabled="isDeleting"
                @click="handleDelete(model.id)"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path
                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                  ></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </div>

          <!-- 空状态 -->
          <div v-if="!loading && models.length === 0" class="empty-state">
            <div class="i-z-brain empty-icon font-size-64px" />
            <div class="empty-text">暂无 AI 模型</div>
            <div class="empty-hint">点击"添加模型"来配置你的第一个 AI 模型</div>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 模型编辑器覆盖面板组件 -->
    <Transition name="slide">
      <AiModelEditor
        v-if="showEditor"
        :editing-model="editingModel"
        @back="closeEditor"
        @save="handleSave"
      />
    </Transition>
  </div>
</template>

<style scoped>
.content-panel {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-color);
}

/* 可滚动内容区 */
.scrollable-content {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
}

/* 列表滑动动画 */
.list-slide-enter-active {
  transition:
    transform 0.2s ease-out,
    opacity 0.15s ease;
}

.list-slide-leave-active {
  transition:
    transform 0.2s ease-in,
    opacity 0.15s ease;
}

.list-slide-enter-from {
  transform: translateX(-100%);
  opacity: 0;
}

.list-slide-enter-to {
  transform: translateX(0);
  opacity: 1;
}

.list-slide-leave-from {
  transform: translateX(0);
  opacity: 1;
}

.list-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

/* 顶部按钮 */
.panel-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 20px;
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.model-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px;
  transition: all 0.2s;
}

.model-item:hover {
  border-color: var(--primary-color);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.model-info {
  flex: 1;
  min-width: 0;
}

.model-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.model-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0;
}

.model-id {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--hover-bg);
  padding: 2px 8px;
  border-radius: 4px;
}

.model-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.model-detail-item {
  font-size: 13px;
  color: var(--text-secondary);
}

.detail-label {
  font-weight: 500;
}

.detail-value {
  color: var(--text-color);
  word-break: break-all;
}

.model-actions {
  display: flex;
  gap: 8px;
  margin-left: 16px;
}

/* 图标按钮颜色样式 */
.edit-btn {
  color: var(--primary-color);
}

.edit-btn:hover:not(:disabled) {
  background: var(--primary-light-bg);
}

.delete-btn {
  color: var(--danger-color);
}

.delete-btn:hover:not(:disabled) {
  background: var(--danger-light-bg);
}

.empty-state {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  text-align: center;
  pointer-events: none;
}

.empty-icon {
  color: var(--text-secondary);
  opacity: 0.3;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 14px;
  color: var(--text-secondary);
}
</style>
