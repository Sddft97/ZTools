<template>
  <div class="update-window" tabindex="0" @keydown="handleKeydown">
    <!-- 头部 -->
    <div class="header">
      <img :src="logo" class="header-icon" draggable="false" />
      <div class="header-info">
        <div class="title">发现新版本 {{ version }}</div>
        <div class="subtitle">ZTools</div>
      </div>
    </div>

    <!-- 更新内容 -->
    <div class="content">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <div class="changelog" v-html="parsedChangelog"></div>
    </div>

    <!-- 底部按钮 -->
    <div class="footer">
      <button class="btn cancel" @click="closeWindow">稍后更新</button>
      <button class="btn confirm" @click="startUpdate">立即更新</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { marked } from 'marked'
import { computed, onMounted, ref } from 'vue'
import logo from '../../assets/logo.png'

const version = ref('')
const changelog = ref('')
const acrylicLightOpacity = ref(78)
const acrylicDarkOpacity = ref(50)

// 解析 Markdown
const parsedChangelog = computed(() => {
  return marked.parse(changelog.value)
})

const startUpdate = (): void => {
  // 发送 quitAndInstall 事件给主进程
  window.electron?.ipcRenderer.send('updater:quit-and-install')
}

const closeWindow = (): void => {
  // 发送 closeWindow 事件给主进程
  window.electron?.ipcRenderer.send('updater:close-window')
}

const handleKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') {
    closeWindow()
  } else if (e.key === 'Enter') {
    startUpdate()
  }
}

function applyAcrylicOverlay(): void {
  const existingStyle = document.getElementById('acrylic-overlay-style')
  if (existingStyle) {
    existingStyle.remove()
  }

  const material = document.documentElement.getAttribute('data-material')

  if (material === 'acrylic') {
    const style = document.createElement('style')
    style.id = 'acrylic-overlay-style'
    style.textContent = `
      body::after {
        content: "";
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: -1;
      }

      /* 明亮模式 */
      @media (prefers-color-scheme: light) {
        body::after {
          background: rgb(255 255 255 / ${acrylicLightOpacity.value}%);
        }
      }

      /* 暗黑模式 */
      @media (prefers-color-scheme: dark) {
        body::after {
          background: rgb(0 0 0 / ${acrylicDarkOpacity.value}%);
        }
      }
    `
    document.head.appendChild(style)
  }
}

onMounted(() => {
  // 聚焦窗口以接收键盘事件
  const el = document.querySelector('.update-window') as HTMLElement
  if (el) el.focus()

  // 监听主进程发送的更新信息
  window.electron?.ipcRenderer.on('update-info', (info: { version: string; changelog: string }) => {
    version.value = info.version
    changelog.value = info.changelog
  })

  // 请求更新信息
  window.electron?.ipcRenderer.send('updater:window-ready')

  // 初始化窗口材质
  if (window.ztools?.getWindowMaterial) {
    window.ztools
      .getWindowMaterial()
      .then((material) => {
        document.documentElement.setAttribute('data-material', material)
        applyAcrylicOverlay()
      })
      .catch((err) => {
        console.error('获取窗口材质失败:', err)
      })
  }

  // 监听窗口材质更新
  if (window.ztools?.onUpdateWindowMaterial) {
    window.ztools.onUpdateWindowMaterial((material) => {
      document.documentElement.setAttribute('data-material', material)
      applyAcrylicOverlay()
    })
  }

  // 监听亚克力透明度更新
  if (window.ztools?.onUpdateAcrylicOpacity) {
    window.ztools.onUpdateAcrylicOpacity((data) => {
      acrylicLightOpacity.value = data.lightOpacity
      acrylicDarkOpacity.value = data.darkOpacity
      applyAcrylicOverlay()
    })
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyAcrylicOverlay()
  })
})
</script>

<style>
/* 全局样式覆盖 */
body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  background: transparent;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}
</style>

<style scoped>
.update-window {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  border: 1px solid rgba(0, 0, 0, 0.1);
  outline: none;
}

@media (prefers-color-scheme: dark) {
  .update-window {
    background: var(--bg-color);
    border: 1px solid rgba(255, 255, 255, 0.1);
    color: #e5e5e5;
  }
}

/* 头部 */
.header {
  padding: 20px 24px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.5);
}

@media (prefers-color-scheme: dark) {
  .header {
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(30, 30, 30, 0.5);
  }
}

.header-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  /* background: linear-gradient(135deg, #3b82f6, #06b6d4); */
  display: flex;
  align-items: center;
  justify-content: center;
  /* color: white; */
  /* box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3); */
  object-fit: contain;
}

.header-info {
  flex: 1;
}

.title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 4px;
}

.subtitle {
  font-size: 13px;
  color: #666;
}

@media (prefers-color-scheme: dark) {
  .subtitle {
    color: #999;
  }
}

/* 内容区域 */
.content {
  flex: 1;
  padding: 2px 0; /* 给滚动条留点位置 */
  overflow-y: auto;
  position: relative;
}

.changelog {
  padding: 20px 24px;
  font-size: 14px;
  line-height: 1.6;
}

/* Markdown样式适配 */
:deep(h1),
:deep(h2),
:deep(h3) {
  margin-top: 1.5em;
  margin-bottom: 0.5em;
  font-weight: 600;
  color: #333;
}

@media (prefers-color-scheme: dark) {
  :deep(h1),
  :deep(h2),
  :deep(h3) {
    color: #e5e5e5;
  }
}

:deep(h1):first-child,
:deep(h2):first-child {
  margin-top: 0;
}

:deep(ul),
:deep(ol) {
  padding-left: 20px;
  margin: 0.5em 0;
}

:deep(li) {
  margin-bottom: 4px;
  color: #444;
}

@media (prefers-color-scheme: dark) {
  :deep(li) {
    color: #ccc;
  }
}

:deep(code) {
  background: rgba(0, 0, 0, 0.05);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.9em;
}

@media (prefers-color-scheme: dark) {
  :deep(code) {
    background: rgba(255, 255, 255, 0.1);
  }
}

/* 底部按钮 */
.footer {
  padding: 16px 24px;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.5);
}

@media (prefers-color-scheme: dark) {
  .footer {
    border-top: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(30, 30, 30, 0.5);
  }
}

.btn {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  border: none;
  outline: none;
}

.cancel {
  background: transparent;
  color: #666;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

.cancel:hover {
  background: rgba(0, 0, 0, 0.05);
  color: #333;
}

@media (prefers-color-scheme: dark) {
  .cancel {
    color: #999;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  .cancel:hover {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
  }
}

.confirm {
  background: #3b82f6;
  color: white;
}

.confirm:hover {
  background: #2563eb;
}

.confirm:active {
  background: #1d4ed8;
}
</style>
