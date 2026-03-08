<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { DetailPanel } from '@/components'

interface AiModel {
  id: string
  label: string
  apiUrl: string
  apiKey: string
  description?: string
  icon?: string
  cost?: number
}

interface Props {
  editingModel: AiModel | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  back: []
  save: [model: AiModel]
}>()

const isEditing = computed(() => props.editingModel !== null)

const showPassword = ref(false)

const formData = ref<AiModel>({
  id: '',
  label: '',
  apiUrl: '',
  apiKey: '',
  description: ''
})

// 监听 editingModel 变化，更新表单数据
watch(
  () => props.editingModel,
  (newModel) => {
    if (newModel) {
      formData.value = { ...newModel }
    } else {
      formData.value = {
        id: '',
        label: '',
        apiUrl: '',
        apiKey: '',
        description: ''
      }
    }
  },
  { immediate: true }
)

function handleSave(): void {
  emit('save', { ...formData.value })
}
</script>
<template>
  <DetailPanel :title="isEditing ? '编辑模型' : '添加模型'" @back="$emit('back')">
    <div class="editor-wrapper">
      <div class="editor-content">
        <div class="form-group">
          <label class="form-label">模型 ID *</label>
          <input
            v-model="formData.id"
            type="text"
            class="input"
            placeholder="例如：qwen-plus-latest"
            :disabled="isEditing"
          />
        </div>

        <div class="form-group">
          <label class="form-label">模型名称 *</label>
          <input v-model="formData.label" type="text" class="input" placeholder="例如：通义千问" />
        </div>

        <div class="form-group">
          <label class="form-label">API 地址 *</label>
          <input
            v-model="formData.apiUrl"
            type="text"
            class="input"
            placeholder="例如：https://dashscope.aliyuncs.com/compatible-mode/v1"
          />
          <p class="form-hint">必须使用与 OpenAI 兼容的 API 格式</p>
        </div>

        <div class="form-group">
          <label class="form-label">API 密钥 *</label>
          <div class="input-wrapper">
            <input
              v-model="formData.apiKey"
              :type="showPassword ? 'text' : 'password'"
              class="input input-with-icon"
              placeholder="输入 API 密钥"
            />
            <button
              type="button"
              class="toggle-password"
              :title="showPassword ? '隐藏密码' : '显示密码'"
              @click="showPassword = !showPassword"
            >
              <svg
                v-if="showPassword"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M3 3L21 21M10.584 10.587C10.2087 10.9624 9.99775 11.4708 9.99775 12C9.99775 12.5292 10.2087 13.0376 10.584 13.413C10.9594 13.7884 11.4678 13.9993 11.997 13.9993C12.5262 13.9993 13.0346 13.7884 13.41 13.413M10.584 10.587L13.41 13.413M10.584 10.587L8.636 8.636M13.41 13.413L15.364 15.364M8.636 8.636C6.736 9.636 5.264 11.364 4 12C5.272 14.272 8.182 18 12 18C13.09 18 14.09 17.727 15 17.273M8.636 8.636L5 5M15.364 15.364C17.264 14.364 18.736 12.636 20 12C18.728 9.728 15.818 6 12 6C10.91 6 9.91 6.273 9 6.727M15.364 15.364L19 19"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <svg
                v-else
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M12 5C8.24261 5 5.43602 7.4404 3.76737 9.43934C2.74421 10.6278 2.74421 13.3722 3.76737 14.5607C5.43602 16.5596 8.24261 19 12 19C15.7574 19 18.564 16.5596 20.2326 14.5607C21.2558 13.3722 21.2558 10.6278 20.2326 9.43934C18.564 7.4404 15.7574 5 12 5Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <path
                  d="M12 15C13.6569 15 15 13.6569 15 12C15 10.3431 13.6569 9 12 9C10.3431 9 9 10.3431 9 12C9 13.6569 10.3431 15 12 15Z"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
            </button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">描述</label>
          <input
            v-model="formData.description"
            type="text"
            class="input"
            placeholder="模型描述（可选）"
          />
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

.editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--divider-color);
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-icon {
  padding-right: 40px;
}

.toggle-password {
  position: absolute;
  right: 12px;
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: color 0.2s ease;
}

.toggle-password:hover {
  color: var(--text-color);
}

.toggle-password:active {
  transform: scale(0.95);
}
</style>
