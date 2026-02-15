<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import ConfirmDialog from './components/common/ConfirmDialog.vue'
import Toast from './components/common/Toast.vue'
import Settings from './components/settings/Settings.vue'
import { useToast } from './composables/useToast'

const { toastState, confirmState, handleConfirm, handleCancel } = useToast()

// 当前激活的页面
const activePage = ref<string>('general')
// 搜索关键词
const searchQuery = ref<string>('')
// 安装插件文件路径
const installPluginFilePath = ref<string>('')

// 各页面搜索框 placeholder，未列出的页面不显示搜索框
const pagePlaceholders: Record<string, string> = {
  shortcuts: '搜索快捷键...',
  plugins: '搜索已安装插件...',
  market: '搜索插件市场...',
  'ai-models': '搜索 AI 模型...',
  'all-commands': '搜索指令...',
  'local-launch': '搜索本地启动项...',
  data: '搜索数据...'
}

// 显示或隐藏搜索框
function updateSubInput(page: string): void {
  searchQuery.value = ''
  const placeholder = pagePlaceholders[page]
  if (placeholder) {
    window.ztools.setSubInput(
      ({ text }) => {
        searchQuery.value = text
      },
      placeholder,
      true
    )
  } else {
    window.ztools.removeSubInput()
  }
}

// 切换页面时处理顶部搜索框
watch(activePage, updateSubInput)

onMounted(() => {
  // 插件进入时根据 feature code 决定显示哪个页面
  window.ztools.onPluginEnter((action) => {
    console.log('设置插件启动:', action)

    // 根据 feature code 设置页面
    const pageMap: Record<string, string> = {
      settings: 'general',
      shortcuts: 'shortcuts',
      plugins: 'plugins',
      'plugin-market': 'market',
      'plugin-market-search': 'market',
      'ai-models': 'ai-models',
      data: 'data',
      'all-commands': 'all-commands',
      sync: 'sync',
      'install-plugin': 'install-plugin'
    }

    const targetPage = pageMap[action.code] || 'general'
    console.log(`跳转到页面: ${targetPage}`)
    activePage.value = targetPage

    // 根据页面决定是否显示搜索框
    updateSubInput(targetPage)

    // 插件市场搜索：将用户输入的文本预填到搜索框
    if (action.code === 'plugin-market-search' && action.payload) {
      searchQuery.value = action.payload
      window.ztools.setSubInputValue(action.payload)
    }

    // 安装插件：从 files payload 中提取文件路径
    if (action.code === 'install-plugin' && action.payload) {
      const files = Array.isArray(action.payload) ? action.payload : []
      if (files.length > 0 && files[0].path) {
        installPluginFilePath.value = files[0].path
      }
    }
  })

  window.ztools.onPluginOut(() => {
    console.log('设置插件退出')
  })

  // 检测操作系统并添加类名
  const userAgent = navigator.userAgent.toLowerCase()
  const platform = navigator.platform.toLowerCase()

  if (platform.includes('win') || userAgent.includes('windows')) {
    document.documentElement.classList.add('os-windows')
  } else if (platform.includes('mac') || userAgent.includes('mac')) {
    document.documentElement.classList.add('os-mac')
  }

  // 初始化时获取当前窗口材质
  if (window.ztools.internal.getWindowMaterial) {
    window.ztools.internal.getWindowMaterial().then((material) => {
      console.log('设置插件初始化材质:', material)
      document.documentElement.setAttribute('data-material', material)
    })
  }

  // 监听窗口材质更新
  if (window.ztools.internal.onUpdateWindowMaterial) {
    window.ztools.internal.onUpdateWindowMaterial((material: 'mica' | 'acrylic' | 'none') => {
      console.log('设置插件收到材质更新:', material)
      document.documentElement.setAttribute('data-material', material)
    })
  }
})
</script>

<template>
  <Settings
    v-model:active-page="activePage"
    :search-query="searchQuery"
    :install-plugin-file-path="installPluginFilePath"
  />
  <!-- 全局Toast组件 -->
  <Toast
    v-model:visible="toastState.visible"
    :message="toastState.message"
    :type="toastState.type"
    :duration="toastState.duration"
  />
  <!-- 全局确认对话框 -->
  <ConfirmDialog
    v-model:visible="confirmState.visible"
    :title="confirmState.title"
    :message="confirmState.message"
    :type="confirmState.type"
    :confirm-text="confirmState.confirmText"
    :cancel-text="confirmState.cancelText"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>
