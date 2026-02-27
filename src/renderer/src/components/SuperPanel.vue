<template>
  <div class="super-panel" @keydown="handleKeydown">
    <!-- 宫格模式：无剪贴板数据，显示固定指令 -->
    <template v-if="mode === 'pinned'">
      <!-- 头部：头像 + 超级面板标题 -->
      <div class="search-header pinned-header">
        <img
          :src="avatar"
          class="header-avatar clickable"
          draggable="false"
          title="显示主搜索窗口"
          @click="showMainWindow"
        />
        <span class="header-text">超级面板</span>
        <div class="header-spacer" />
        <div
          class="header-menu-btn"
          :class="{ 'window-match-blink': windowMatchBlink }"
          title="窗口匹配"
          @click="openWindowMatch"
          @animationend="windowMatchBlink = false"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="1"
              y="2"
              width="14"
              height="11"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.3"
              fill="none"
            />
            <rect x="1" y="2" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
            <circle cx="3" cy="3.5" r="0.7" fill="currentColor" />
            <circle cx="5" cy="3.5" r="0.7" fill="currentColor" />
          </svg>
        </div>
      </div>

      <!-- 固定列表：使用 Draggable 组件 -->
      <Draggable
        v-if="pinnedCommands.length > 0"
        v-model="pinnedCommands"
        class="pinned-grid"
        :item-key="(item: any) => `${item.name}|${item.path}|${item.featureCode || ''}`"
        :animation="200"
        ghost-class="ghost"
        chosen-class="chosen"
        @end="onDragEnd"
      >
        <template #item="{ element: cmd, index }">
          <div
            class="grid-item"
            :class="{ selected: index === selectedIndex }"
            style="cursor: move"
            @click="launch(cmd)"
            @mouseenter="selectedIndex = index"
            @contextmenu.prevent="handleContextMenu(cmd)"
          >
            <img
              v-if="cmd.icon && !iconErrors.has(getItemKey(cmd))"
              :src="cmd.icon"
              class="grid-icon"
              draggable="false"
              @error="iconErrors.add(getItemKey(cmd))"
            />
            <div v-else class="grid-icon-placeholder">
              {{ cmd.name.charAt(0).toUpperCase() }}
            </div>
            <span class="grid-name">{{ cmd.name }}</span>
          </div>
        </template>
      </Draggable>
      <!-- 空状态 -->
      <div v-if="pinnedCommands.length === 0" class="empty-state">
        <span class="empty-text">暂无固定项目</span>
      </div>
    </template>

    <!-- 列表模式：有搜索结果 -->
    <template v-else-if="mode === 'search'">
      <!-- 头部：剪贴板内容描述 -->
      <div class="search-header">
        <div class="header-menu-btn" title="返回固定列表" @click="showPinned">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="3.5" cy="3.5" r="1.5" fill="currentColor" />
            <circle cx="9" cy="3.5" r="1.5" fill="currentColor" />
            <circle cx="14.5" cy="3.5" r="1.5" fill="currentColor" />
            <circle cx="3.5" cy="9" r="1.5" fill="currentColor" />
            <circle cx="9" cy="9" r="1.5" fill="currentColor" />
            <circle cx="14.5" cy="9" r="1.5" fill="currentColor" />
            <circle cx="3.5" cy="14.5" r="1.5" fill="currentColor" />
            <circle cx="9" cy="14.5" r="1.5" fill="currentColor" />
            <circle cx="14.5" cy="14.5" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <span class="header-text">{{ clipboardDescription }}</span>
        <div class="header-spacer" />
        <div
          class="header-menu-btn"
          :class="{ 'window-match-blink': windowMatchBlink }"
          title="窗口匹配"
          @click="openWindowMatch"
          @animationend="windowMatchBlink = false"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect
              x="1"
              y="2"
              width="14"
              height="11"
              rx="1.5"
              stroke="currentColor"
              stroke-width="1.3"
              fill="none"
            />
            <rect x="1" y="2" width="14" height="3" rx="1.5" fill="currentColor" opacity="0.3" />
            <circle cx="3" cy="3.5" r="0.7" fill="currentColor" />
            <circle cx="5" cy="3.5" r="0.7" fill="currentColor" />
          </svg>
        </div>
      </div>

      <!-- 搜索结果列表 -->
      <div class="search-list">
        <div
          v-for="(result, index) in searchResults"
          :key="`${result.name}|${result.path}-${result.featureCode || ''}`"
          class="list-item"
          :class="{ selected: index === selectedIndex }"
          @click="launch(result)"
          @mouseenter="selectedIndex = index"
        >
          <img
            v-if="result.icon && !iconErrors.has(getItemKey(result))"
            :src="result.icon"
            class="list-icon"
            draggable="false"
            @error="iconErrors.add(getItemKey(result))"
          />
          <div v-else class="list-icon-placeholder">
            {{ result.name.charAt(0).toUpperCase() }}
          </div>
          <div class="list-info">
            <span class="list-name">{{ result.name }}</span>
            <span v-if="result.pluginExplain" class="list-desc">{{ result.pluginExplain }}</span>
          </div>
        </div>
        <!-- 空状态 -->
        <div v-if="searchResults.length === 0" class="empty-state">
          <span class="empty-text">无匹配结果</span>
        </div>
      </div>
    </template>

    <!-- 加载中 -->
    <div v-else class="loading-state">
      <span class="loading-text">加载中...</span>
    </div>

    <!-- 窗口匹配底部滑出面板 -->
    <Transition name="slide-up">
      <div v-if="showWindowMatch" class="window-match-overlay">
        <div class="window-match-backdrop" @click="closeWindowMatch" />
        <div class="window-match-panel">
          <div class="window-match-header">
            <span class="window-match-title">窗口匹配</span>
            <div class="header-menu-btn" title="关闭" @click="closeWindowMatch">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M3 3l8 8M11 3l-8 8"
                  stroke="currentColor"
                  stroke-width="1.5"
                  stroke-linecap="round"
                />
              </svg>
            </div>
          </div>
          <div class="window-match-list">
            <div
              v-for="(item, index) in windowMatchResults"
              :key="`wm-${item.path}-${item.featureCode || ''}`"
              class="list-item"
              :class="{ selected: index === windowMatchSelectedIndex }"
              @click="launchWindowMatch(item)"
              @mouseenter="windowMatchSelectedIndex = index"
            >
              <img
                v-if="item.icon && !iconErrors.has(getItemKey(item))"
                :src="item.icon"
                class="list-icon"
                draggable="false"
                @error="iconErrors.add(getItemKey(item))"
              />
              <div v-else class="list-icon-placeholder">
                {{ item.name.charAt(0).toUpperCase() }}
              </div>
              <div class="list-info">
                <span class="list-name">{{ item.name }}</span>
                <span v-if="item.pluginExplain" class="list-desc">{{ item.pluginExplain }}</span>
              </div>
            </div>
            <div v-if="windowMatchResults.length === 0" class="empty-state window-match-empty">
              <span class="empty-text">无匹配结果</span>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import Draggable from 'vuedraggable'
import defaultAvatar from '../assets/image/default.png'

interface CommandItem {
  name: string
  path: string
  icon?: string
  type?: string
  subType?: string
  featureCode?: string
  pluginName?: string
  pluginExplain?: string
  cmdType?: string
  param?: any
}

interface ClipboardContent {
  type: 'text' | 'image' | 'file'
  text?: string
  image?: string
  files?: Array<{ path: string; name: string; isDirectory: boolean }>
}

const mode = ref<'pinned' | 'search' | 'loading'>('loading')
const pinnedCommands = ref<CommandItem[]>([])
const searchResults = ref<CommandItem[]>([])
const selectedIndex = ref(0)
const iconErrors = ref<Set<string>>(new Set())
// 保存当前的剪贴板内容（由搜索结果携带）
const currentClipboardContent = ref<ClipboardContent | null>(null)
// 头像（默认使用内置头像）
const avatar = ref(defaultAvatar)
const acrylicLightOpacity = ref(78)
const acrylicDarkOpacity = ref(50)
const primaryColor = ref('blue')
const customColor = ref('#db2777')
// 窗口匹配相关状态
const showWindowMatch = ref(false)
const windowMatchResults = ref<CommandItem[]>([])
const windowMatchSelectedIndex = ref(0)
const currentWindowInfo = ref<{ app?: string; title?: string } | null>(null)
// 窗口匹配图标闪动
const windowMatchBlink = ref(false)

function getThemeColor(colorName: string, isDark: boolean): string {
  const colors: Record<string, { light: string; dark: string }> = {
    blue: { light: '#0284c7', dark: '#38bdf8' },
    purple: { light: '#7c3aed', dark: '#a78bfa' },
    green: { light: '#059669', dark: '#34d399' },
    orange: { light: '#ea580c', dark: '#fb923c' },
    red: { light: '#dc2626', dark: '#f87171' },
    pink: { light: '#db2777', dark: '#f472b6' }
  }
  const color = colors[colorName]
  if (color) {
    return isDark ? color.dark : color.light
  }
  return isDark ? '#38bdf8' : '#0284c7'
}

function applyPrimaryColor(): void {
  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  let colorValue = ''

  if (primaryColor.value === 'custom') {
    colorValue = customColor.value
  } else {
    colorValue = getThemeColor(primaryColor.value, isDark)
  }

  document.documentElement.style.setProperty('--primary-color', colorValue)
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

// 剪贴板内容描述
const clipboardDescription = computed(() => {
  const content = currentClipboardContent.value
  if (!content) return ''

  if (content.type === 'text' && content.text) {
    return `选中的文本 ${content.text.length} 个`
  } else if (content.type === 'image') {
    return '选中的图片'
  } else if (content.type === 'file' && content.files) {
    return `选中的文件 ${content.files.length} 个`
  }
  return ''
})

// 拖动排序结束后保存顺序
async function onDragEnd(): Promise<void> {
  try {
    // 将响应式对象转换为纯 JSON 对象，避免克隆错误
    const plainCommands = JSON.parse(JSON.stringify(pinnedCommands.value))
    await window.ztools.updateSuperPanelPinnedOrder(plainCommands)
  } catch (error) {
    console.error('保存固定列表顺序失败:', error)
  }
}

// 右键菜单
async function handleContextMenu(cmd: CommandItem): Promise<void> {
  const menuItems = [
    {
      id: `unpin:${JSON.stringify({ path: cmd.path, featureCode: cmd.featureCode })}`,
      label: '取消固定'
    }
  ]
  await window.ztools.showContextMenu(menuItems)
}

// 返回固定列表
function showPinned(): void {
  window.ztools.superPanelShowPinned()
}

// 点击头像：隐藏超级面板，显示主搜索窗口
function showMainWindow(): void {
  window.ztools.superPanelShowMainWindow()
}

// 打开窗口匹配面板
function openWindowMatch(): void {
  showWindowMatch.value = true
  windowMatchBlink.value = false
  windowMatchSelectedIndex.value = 0
  // 如果已有结果（自动搜索过），直接使用；否则发起搜索
  if (windowMatchResults.value.length === 0 && currentWindowInfo.value) {
    window.ztools.superPanelSearchWindowCommands(
      JSON.parse(JSON.stringify(currentWindowInfo.value))
    )
  }
}

// 关闭窗口匹配面板
function closeWindowMatch(): void {
  showWindowMatch.value = false
}

// 从窗口匹配面板启动指令
async function launchWindowMatch(cmd: CommandItem): Promise<void> {
  closeWindowMatch()
  await launch(cmd)
}

function getItemKey(item: CommandItem): string {
  return `${item.path}-${item.featureCode || ''}-${item.name}`
}

// 获取当前显示的列表
function getCurrentList(): CommandItem[] {
  return mode.value === 'pinned' ? pinnedCommands.value : searchResults.value
}

// 启动指令（携带剪贴板内容）
async function launch(cmd: CommandItem): Promise<void> {
  try {
    console.log('启动指令:', cmd, '剪贴板内容:', currentClipboardContent.value?.type)
    // 将命令和剪贴板内容一起发送给主进程，由主进程转发给主渲染进程处理
    const launchData = JSON.parse(
      JSON.stringify({
        ...cmd,
        clipboardContent: currentClipboardContent.value
      })
    )
    await window.ztools.superPanelLaunch(launchData)
  } catch (error) {
    console.error('超级面板启动失败:', error)
  }
}

// 键盘导航
function handleKeydown(event: KeyboardEvent): void {
  const list = getCurrentList()
  if (list.length === 0) return

  if (mode.value === 'pinned') {
    // 宫格模式：3 列布局，支持上下左右
    const cols = 3
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        if (selectedIndex.value >= cols) {
          selectedIndex.value -= cols
        }
        break
      case 'ArrowDown':
        event.preventDefault()
        if (selectedIndex.value + cols < list.length) {
          selectedIndex.value += cols
        }
        break
      case 'ArrowLeft':
        event.preventDefault()
        if (selectedIndex.value > 0) {
          selectedIndex.value--
        }
        break
      case 'ArrowRight':
        event.preventDefault()
        if (selectedIndex.value < list.length - 1) {
          selectedIndex.value++
        }
        break
      case 'Enter':
        event.preventDefault()
        if (list[selectedIndex.value]) {
          launch(list[selectedIndex.value])
        }
        break
      case 'Escape':
        event.preventDefault()
        window.close()
        break
    }
  } else {
    // 列表模式：上下导航
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault()
        if (selectedIndex.value > 0) {
          selectedIndex.value--
        }
        break
      case 'ArrowDown':
        event.preventDefault()
        if (selectedIndex.value < list.length - 1) {
          selectedIndex.value++
        }
        break
      case 'Enter':
        event.preventDefault()
        if (list[selectedIndex.value]) {
          launch(list[selectedIndex.value])
        }
        break
      case 'Escape':
        event.preventDefault()
        window.close()
        break
    }
  }

  // 确保选中项可见
  scrollToSelected()
}

// 滚动到选中项
function scrollToSelected(): void {
  const container = document.querySelector('.search-list') || document.querySelector('.pinned-grid')
  if (!container) return

  const selectedEl = container.querySelector('.selected') as HTMLElement
  if (selectedEl) {
    selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }
}

// 滚动到顶部
function scrollToTop(): void {
  nextTick(() => {
    const container =
      document.querySelector('.search-list') || document.querySelector('.pinned-grid')
    if (container) {
      container.scrollTop = 0
    }
  })
}

onMounted(() => {
  // 监听超级面板数据（从主进程发送）
  window.ztools.onSuperPanelData((data) => {
    console.log(
      '[SuperPanel] 收到数据, type:',
      data.type,
      'count:',
      data.commands?.length || data.results?.length || 0
    )
    // 保存窗口信息
    if (data.windowInfo) {
      currentWindowInfo.value = data.windowInfo
    }
    // 收到新数据时关闭窗口匹配面板、重置闪动状态
    showWindowMatch.value = false
    windowMatchBlink.value = false
    windowMatchResults.value = []

    // 自动发起窗口匹配搜索（用于判断是否需要闪动图标）
    if (data.windowInfo) {
      window.ztools.superPanelSearchWindowCommands(
        JSON.parse(JSON.stringify(data.windowInfo))
      )
    }

    if (data.type === 'pinned') {
      mode.value = 'pinned'
      pinnedCommands.value = data.commands || []
      selectedIndex.value = 0
      currentClipboardContent.value = null
      scrollToTop()
    } else if (data.type === 'search') {
      mode.value = 'search'
      searchResults.value = data.results || []
      selectedIndex.value = 0
      // 保存搜索结果携带的剪贴板内容
      currentClipboardContent.value = data.clipboardContent || null
      scrollToTop()
    }
  })

  // 通知主进程窗口已准备好
  window.ztools.superPanelReady()

  // 监听窗口匹配搜索结果
  window.ztools.onSuperPanelWindowCommandsData((data: { results: any[] }) => {
    windowMatchResults.value = data.results || []
    windowMatchSelectedIndex.value = 0
    // 有匹配结果且面板未打开时，触发图标闪动
    if (data.results?.length > 0 && !showWindowMatch.value) {
      windowMatchBlink.value = true
    }
  })

  // 加载设置（头像、亚克力透明度、主题色）
  window.ztools
    .dbGet('settings-general')
    .then((settings) => {
      if (settings?.avatar) {
        avatar.value = settings.avatar
      }
      if (settings) {
        acrylicLightOpacity.value = settings.acrylicLightOpacity ?? 78
        acrylicDarkOpacity.value = settings.acrylicDarkOpacity ?? 50
        if (settings.primaryColor) {
          primaryColor.value = settings.primaryColor
        }
        if (settings.customColor) {
          customColor.value = settings.customColor
        }
        applyPrimaryColor()
      }
    })
    .catch(() => {
      // ignore
    })

  // 初始化时获取当前窗口材质
  if (window.ztools?.getWindowMaterial) {
    window.ztools
      .getWindowMaterial()
      .then((material: string) => {
        document.documentElement.setAttribute('data-material', material)
        applyAcrylicOverlay()
      })
      .catch((err: Error) => {
        console.error('获取窗口材质失败:', err)
      })
  }

  // 监听窗口材质更新
  if (window.ztools?.onUpdateWindowMaterial) {
    window.ztools.onUpdateWindowMaterial((material: 'mica' | 'acrylic' | 'none') => {
      document.documentElement.setAttribute('data-material', material)
      applyAcrylicOverlay()
    })
  }

  // 监听亚克力透明度更新事件
  if (window.ztools?.onUpdateAcrylicOpacity) {
    window.ztools.onUpdateAcrylicOpacity((data: { lightOpacity: number; darkOpacity: number }) => {
      acrylicLightOpacity.value = data.lightOpacity
      acrylicDarkOpacity.value = data.darkOpacity
      applyAcrylicOverlay()
    })
  }

  // 监听主题色更新
  if (window.ztools?.onUpdatePrimaryColor) {
    window.ztools.onUpdatePrimaryColor((data: { primaryColor: string; customColor?: string }) => {
      primaryColor.value = data.primaryColor
      if (data.customColor) {
        customColor.value = data.customColor
      }
      applyPrimaryColor()
    })
  }

  // 监听系统主题变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyPrimaryColor()
    applyAcrylicOverlay()
  })

  // 监听头像更新事件
  window.ztools.onUpdateAvatar((newAvatar: string) => {
    console.log('[SuperPanel] 收到头像更新:', newAvatar)
    avatar.value = newAvatar || defaultAvatar
  })

  // 监听右键菜单命令
  window.ztools.onContextMenuCommand(async (command: string) => {
    console.log('[SuperPanel] 收到右键菜单命令:', command)
    if (command.startsWith('unpin:')) {
      const jsonStr = command.replace('unpin:', '')
      try {
        const { path, featureCode } = JSON.parse(jsonStr)
        console.log('[SuperPanel] 准备取消固定:', { path, featureCode })
        await window.ztools.unpinSuperPanelCommand(path, featureCode)
        console.log('[SuperPanel] 取消固定成功')
      } catch (error) {
        console.error('[SuperPanel] 取消固定失败:', error)
      }
    }
  })

  // 聚焦以接收键盘事件
  const panel = document.querySelector('.super-panel') as HTMLElement
  if (panel) {
    panel.setAttribute('tabindex', '0')
    panel.focus()
  }
})

// 键盘焦点保持
function handleFocusOut(): void {
  const panel = document.querySelector('.super-panel') as HTMLElement
  if (panel) {
    panel.focus()
  }
}

onMounted(() => {
  document.addEventListener('focusout', handleFocusOut)
})

onUnmounted(() => {
  document.removeEventListener('focusout', handleFocusOut)
})
</script>

<style scoped>
.super-panel {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  border-radius: 10px;
  overflow: hidden;
  outline: none;
  user-select: none;
}

/* ========== 头部 ========== */
.search-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
}

.header-menu-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  color: var(--text-secondary);
  transition: all 0.15s;
  flex-shrink: 0;
}

.header-menu-btn:hover {
  background: var(--hover-bg);
  color: var(--text-color);
}

.header-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.clickable {
  cursor: pointer;
  transition: opacity 0.15s;
}

.clickable:hover {
  opacity: 0.7;
}

.header-avatar-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-primary);
  font-size: 14px;
  font-weight: bold;
  flex-shrink: 0;
}

.header-text {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== 宫格模式 ========== */
.pinned-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  align-content: start;
  gap: 2px;
  padding: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.grid-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background-color 0.15s;
  overflow: hidden;
  min-height: 80px;
  height: fit-content;
}

.grid-item:hover,
.grid-item.selected {
  background: var(--hover-bg);
}

.grid-item.selected {
  background: var(--active-bg);
}

.grid-icon {
  width: 36px;
  height: 36px;
  margin-bottom: 6px;
  border-radius: 8px;
  flex-shrink: 0;
  object-fit: contain;
}

.grid-icon-placeholder {
  width: 36px;
  height: 36px;
  margin-bottom: 6px;
  border-radius: 8px;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-primary);
  font-size: 16px;
  font-weight: bold;
  flex-shrink: 0;
}

.grid-name {
  font-size: 11px;
  font-weight: 500;
  pointer-events: none; /* 防止拖动时文字阻碍拖动 */
  line-height: 14px;
  color: var(--text-color);
  text-align: center;
  width: 100%;
  padding: 0 2px;
  min-height: 28px;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-all;
  flex-shrink: 0;
}

/* 拖动时的样式 */
.ghost {
  opacity: 0.5;
  background: var(--border-color);
}

.chosen {
  opacity: 0.8;
}

/* 防止拖动时图标和文字阻碍拖动 */
:deep(.ghost .grid-icon),
:deep(.ghost .grid-icon-placeholder),
:deep(.ghost .grid-name),
:deep(.chosen .grid-icon),
:deep(.chosen .grid-icon-placeholder),
:deep(.chosen .grid-name) {
  pointer-events: none;
}

/* ========== 列表模式 ========== */
.search-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
}

.list-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
  flex-shrink: 0;
}

.list-item:hover,
.list-item.selected {
  background: var(--hover-bg);
}

.list-item.selected {
  background: var(--active-bg);
}

.list-icon {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  flex-shrink: 0;
  object-fit: contain;
}

.list-icon-placeholder {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: var(--primary-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-on-primary);
  font-size: 13px;
  font-weight: bold;
  flex-shrink: 0;
}

.list-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.list-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-color);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.list-desc {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ========== 空状态和加载状态 ========== */
.empty-state,
.loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  min-height: 100px;
  grid-column: 1 / -1;
}

.empty-text,
.loading-text {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ========== 标题栏间距 ========== */
.header-spacer {
  flex: 1;
}

/* ========== 窗口匹配底部滑出面板 ========== */
.window-match-overlay {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  border-radius: 10px;
}

.window-match-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.2);
}

.window-match-panel {
  position: relative;
  z-index: 1;
  background: #f4f4f4;
  border-top: 1px solid var(--divider-color);
  border-radius: 12px 12px 0 0;
  max-height: 75%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.1);
}

@media (prefers-color-scheme: dark) {
  .window-match-panel {
    background: #303133;
  }
}

.window-match-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid var(--divider-color);
  flex-shrink: 0;
}

.window-match-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-color);
}

.window-match-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
}

.window-match-empty {
  min-height: 60px;
}

/* ========== 滑出动画 ========== */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: opacity 0.2s ease;
}

.slide-up-enter-active .window-match-panel,
.slide-up-leave-active .window-match-panel {
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.slide-up-enter-from,
.slide-up-leave-to {
  opacity: 0;
}

.slide-up-enter-from .window-match-panel,
.slide-up-leave-to .window-match-panel {
  transform: translateY(100%);
}
/* ========== 窗口匹配图标闪动 ========== */
.window-match-blink {
  animation: blink-highlight 0.5s ease-in-out 3;
  color: var(--primary-color);
}

@keyframes blink-highlight {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.15;
  }
}
</style>
