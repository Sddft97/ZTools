<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useToast, DetailPanel } from '@/components'

interface WebSearchEngine {
  id: string
  name: string
  url: string
  icon: string
  enabled: boolean
}

interface Props {
  editingEngine: WebSearchEngine | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  back: []
  save: [engine: WebSearchEngine]
}>()

const { error } = useToast()

const isEditing = computed(() => props.editingEngine !== null)
const isFetchingIcon = ref(false)

const formData = ref<WebSearchEngine>({
  id: '',
  name: '',
  url: '',
  icon: '',
  enabled: true
})

// 监听 editingEngine 变化
watch(
  () => props.editingEngine,
  (newEngine) => {
    if (newEngine) {
      formData.value = { ...newEngine }
    } else {
      formData.value = {
        id: '',
        name: '',
        url: '',
        icon: '',
        enabled: true
      }
    }
  },
  { immediate: true }
)

// 自动获取 favicon
async function handleFetchFavicon(): Promise<void> {
  if (!formData.value.url) {
    error('请先填写 URL 模板')
    return
  }

  isFetchingIcon.value = true
  try {
    const result = await window.ztools.internal.webSearch.fetchFavicon(formData.value.url)
    if (result.success && result.data) {
      formData.value.icon = result.data
    } else {
      error('未能获取到图标')
    }
  } catch (err) {
    console.error('获取 favicon 失败:', err)
    error('获取图标失败')
  } finally {
    isFetchingIcon.value = false
  }
}

function handleSave(): void {
  if (!formData.value.name || !formData.value.url) {
    error('请填写名称和 URL 模板')
    return
  }
  if (!formData.value.url.includes('{q}')) {
    error('URL 模板必须包含 {q} 占位符')
    return
  }
  emit('save', { ...formData.value })
}
</script>
<template>
  <DetailPanel :title="isEditing ? '编辑搜索引擎' : '添加搜索引擎'" @back="$emit('back')">
    <div class="editor-wrapper">
      <div class="editor-content">
        <div class="form-group">
          <label class="form-label">名称 *</label>
          <input
            v-model="formData.name"
            type="text"
            class="input"
            placeholder="例如：Google 搜索"
          />
        </div>

        <div class="form-group">
          <label class="form-label">URL 模板 *</label>
          <input
            v-model="formData.url"
            type="text"
            class="input"
            placeholder="例如：https://www.google.com/search?q={q}"
          />
          <p class="form-hint">使用 {q} 作为搜索关键词的占位符</p>
        </div>

        <div class="form-group">
          <label class="form-label">图标</label>
          <div class="icon-row">
            <div class="icon-preview">
              <img
                v-if="formData.icon"
                :src="formData.icon"
                class="preview-img"
                alt=""
                @error="($event.target as HTMLImageElement).style.display = 'none'"
              />
              <div class="i-z-search font-size-24px"></div>
            </div>
            <button
              class="btn btn-sm"
              :disabled="isFetchingIcon || !formData.url"
              @click="handleFetchFavicon"
            >
              {{ isFetchingIcon ? '获取中...' : '自动获取' }}
            </button>
          </div>
          <p class="form-hint">根据 URL 自动获取网站图标</p>
        </div>
      </div>

      <div class="editor-footer">
        <button class="btn" @click="$emit('back')">取消</button>
        <button class="btn btn-solid" @click="handleSave">保存</button>
      </div>
    </div>
  </DetailPanel>
</template>

<style scoped>
.editor-wrapper {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.editor-content {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-color);
  margin-bottom: 8px;
}

.form-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 4px;
  margin-bottom: 0;
}

.icon-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-preview {
  width: 40px;
  height: 40px;
  border-radius: 8px;
  border: 1px solid var(--control-border);
  background: var(--control-bg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.preview-img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.preview-placeholder {
  color: var(--text-secondary);
  opacity: 0.5;
}

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--divider-color);
}
</style>
