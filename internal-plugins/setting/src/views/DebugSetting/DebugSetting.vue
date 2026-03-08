<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'

interface LogEntry {
  id: number
  timestamp: number
  level: string
  source: string
  message: string
}

const MAX_LOGS = 5000

const logContainer = ref<HTMLElement | null>(null)
const enabled = ref(false)
const paused = ref(false)
const autoScroll = ref(true)
const searchText = ref('')
const allLogs = ref<LogEntry[]>([])
const activeLevels = ref(new Set(['error', 'warn', 'info', 'debug', 'verbose']))

const levelOptions = [
  { key: 'error', label: 'ERROR' },
  { key: 'warn', label: 'WARN' },
  { key: 'info', label: 'INFO' },
  { key: 'debug', label: 'DEBUG' },
  { key: 'verbose', label: 'TRACE' }
]

function levelLabel(level: string): string {
  if (level === 'verbose') return 'TRACE'
  return level.toUpperCase()
}

const filteredLogs = computed(() => {
  let logs = allLogs.value.filter((log) => activeLevels.value.has(log.level))
  if (searchText.value) {
    const keyword = searchText.value.toLowerCase()
    logs = logs.filter(
      (log) =>
        log.message.toLowerCase().includes(keyword) || log.source.toLowerCase().includes(keyword)
    )
  }
  return logs
})

const counts = computed(() => {
  const c = { error: 0, warn: 0, info: 0, debug: 0, verbose: 0 }
  for (const log of allLogs.value) {
    if (log.level in c) c[log.level as keyof typeof c]++
  }
  return c
})

/** 处理新日志条目推送 */
function handleLogEntries(entries: LogEntry[]): void {
  if (paused.value) return

  allLogs.value.push(...entries)

  if (allLogs.value.length > MAX_LOGS) {
    allLogs.value = allLogs.value.slice(-MAX_LOGS)
  }

  if (autoScroll.value) {
    nextTick(() => {
      const el = logContainer.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
}

/** 用户切换开关 */
async function handleToggle(): Promise<void> {
  if (enabled.value) {
    await window.ztools.internal.logEnable()
    const buffer = await window.ztools.internal.logGetBuffer()
    allLogs.value = buffer
    window.ztools.internal.onLogEntries(handleLogEntries)
    nextTick(() => {
      const el = logContainer.value
      if (el) el.scrollTop = el.scrollHeight
    })
  } else {
    window.ztools.internal.offLogEntries(handleLogEntries)
    await window.ztools.internal.logDisable()
    allLogs.value = []
  }
}

function clearLogs(): void {
  allLogs.value = []
}

function toggleLevel(level: string): void {
  if (activeLevels.value.has(level)) {
    activeLevels.value.delete(level)
  } else {
    activeLevels.value.add(level)
  }
  activeLevels.value = new Set(activeLevels.value)
}

function togglePause(): void {
  paused.value = !paused.value
}

function handleScroll(): void {
  const el = logContainer.value
  if (!el) return
  const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 30
  autoScroll.value = isAtBottom
}

function scrollToBottom(): void {
  autoScroll.value = true
  nextTick(() => {
    const el = logContainer.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getHours().toString().padStart(2, '0')}:` +
    `${d.getMinutes().toString().padStart(2, '0')}:` +
    `${d.getSeconds().toString().padStart(2, '0')}.` +
    `${d.getMilliseconds().toString().padStart(3, '0')}`
  )
}

// 组件挂载时：查询后端状态，恢复 UI
onMounted(async () => {
  const isEnabled = await window.ztools.internal.logIsEnabled()
  if (isEnabled) {
    enabled.value = true
    // 重新订阅推送（WebContents 可能是同一个，但 preload 回调列表已重置或保留）
    await window.ztools.internal.logSubscribe()
    const buffer = await window.ztools.internal.logGetBuffer()
    allLogs.value = buffer
    window.ztools.internal.onLogEntries(handleLogEntries)
    nextTick(() => {
      const el = logContainer.value
      if (el) el.scrollTop = el.scrollHeight
    })
  }
})

// 组件卸载时：解绑前端回调，但不关闭后端日志收集
onUnmounted(() => {
  window.ztools.internal.offLogEntries(handleLogEntries)
})
</script>

<template>
  <div class="content-panel debug-console">
    <!-- 标题区 -->
    <div class="console-header">
      <div class="header-info">
        <h2 class="section-title">调试控制台</h2>
        <p class="section-desc">实时查看应用日志，用于调试和问题排查</p>
      </div>
      <div class="header-toggle">
        <span class="toggle-label">{{ enabled ? '已启用' : '已禁用' }}</span>
        <label class="toggle">
          <input v-model="enabled" type="checkbox" @change="handleToggle" />
          <span class="toggle-slider"></span>
        </label>
      </div>
    </div>

    <!-- 工具栏 -->
    <div v-if="enabled" class="console-toolbar">
      <div class="toolbar-left">
        <!-- <span class="toolbar-tab">&gt;_ CONSOLE</span> -->
        <div class="level-filters">
          <button
            v-for="opt in levelOptions"
            :key="opt.key"
            class="level-filter-btn"
            :class="[`level-${opt.key}`, { active: activeLevels.has(opt.key) }]"
            @click="toggleLevel(opt.key)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
      <div class="toolbar-right">
        <div class="search-wrapper">
          <svg class="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2" />
            <path
              d="M21 21L16.65 16.65"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
            />
          </svg>
          <input
            v-model="searchText"
            type="text"
            class="search-input"
            placeholder="Filter logs..."
          />
        </div>
        <button class="btn btn-icon" :title="paused ? '恢复实时' : '暂停'" @click="togglePause">
          <svg v-if="paused" width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M5 3L19 12L5 21V3Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none">
            <rect x="6" y="4" width="4" height="16" rx="1" stroke="currentColor" stroke-width="2" />
            <rect
              x="14"
              y="4"
              width="4"
              height="16"
              rx="1"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
        </button>
        <button class="btn btn-icon" title="清空日志" @click="clearLogs">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 6H5H21"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <path
              d="M8 6V4C8 3.46957 8.21071 2.96086 8.58579 2.58579C8.96086 2.21071 9.46957 2 10 2H14C14.5304 2 15.0391 2.21071 15.4142 2.58579C15.7893 2.96086 16 3.46957 16 4V6M19 6V20C19 20.5304 18.7893 21.0391 18.4142 21.4142C18.0391 21.7893 17.5304 22 17 22H7C6.46957 22 5.96086 21.7893 5.58579 21.4142C5.21071 21.0391 5 20.5304 5 20V6H19Z"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <!-- 日志列表 -->
    <div v-if="enabled" ref="logContainer" class="log-list" @scroll="handleScroll">
      <div
        v-for="entry in filteredLogs"
        :key="entry.id"
        class="log-entry"
        :class="`log-${entry.level}`"
      >
        <span class="log-time">{{ formatTime(entry.timestamp) }}</span>
        <span class="log-level-badge" :class="`badge-${entry.level}`">
          {{ levelLabel(entry.level) }}
        </span>
        <span class="log-source">{{ entry.source }}</span>
        <span class="log-message">{{ entry.message }}</span>
      </div>
      <!-- 空状态 -->
      <div v-if="filteredLogs.length === 0" class="empty-state">
        <p>{{ allLogs.length === 0 ? '暂无日志，等待日志输出...' : '没有匹配的日志' }}</p>
      </div>
    </div>

    <!-- 未启用状态 -->
    <div v-if="!enabled" class="disabled-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style="opacity: 0.3">
        <rect x="2" y="3" width="20" height="18" rx="2" stroke="currentColor" stroke-width="1.5" />
        <path d="M2 8H22" stroke="currentColor" stroke-width="1.5" />
        <path
          d="M7 13L10 16L7 19"
          stroke="currentColor"
          stroke-width="1.5"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
        <path d="M13 19H17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
      </svg>
      <p class="disabled-text">开启开关以查看实时日志</p>
    </div>

    <!-- 底部状态栏 -->
    <div v-if="enabled" class="console-statusbar">
      <div class="status-counts">
        <span v-if="counts.error > 0" class="count-item count-error"
          >{{ counts.error }} errors</span
        >
        <span v-if="counts.warn > 0" class="count-item count-warn">{{ counts.warn }} warnings</span>
        <span class="count-item count-info">{{ counts.info }} info</span>
      </div>
      <div class="status-right">
        <button
          class="status-btn"
          :class="{ active: autoScroll }"
          title="自动滚动到底部"
          @click="scrollToBottom"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 5V19M12 19L5 12M12 19L19 12"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
          Scroll
        </button>
        <span class="live-indicator" :class="{ active: !paused }">
          <span class="live-dot"></span>
          Live
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.debug-console {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  padding: 0;
}

/* 标题区 */
.console-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 20px 16px;
  flex-shrink: 0;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
}

.section-desc {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
}

.header-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.toggle-label {
  font-size: 13px;
  color: var(--text-secondary);
}

/* 工具栏 */
.console-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 16px;
  border-top: 1px solid var(--divider-color);
  border-bottom: 1px solid var(--divider-color);
  gap: 12px;
  flex-shrink: 0;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.toolbar-tab {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 4px 8px;
  white-space: nowrap;
}

.level-filters {
  display: flex;
  gap: 4px;
}

.level-filter-btn {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
  font-weight: 500;
  opacity: 0.5;
}

.level-filter-btn:hover {
  opacity: 0.8;
}

.level-filter-btn.active {
  opacity: 1;
  font-weight: 600;
}

.level-filter-btn.active.level-error {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.level-filter-btn.active.level-warn {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.level-filter-btn.active.level-info {
  color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.level-filter-btn.active.level-debug {
  color: #6b7280;
  background: rgba(107, 114, 128, 0.1);
}

.level-filter-btn.active.level-verbose {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.1);
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.search-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 8px;
  color: var(--text-secondary);
  pointer-events: none;
}

.search-input {
  width: 160px;
  height: 28px;
  font-size: 12px;
  padding: 0 8px 0 28px;
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  background: var(--control-bg);
  color: var(--text-color);
  outline: none;
  transition: all 0.2s;
}

.search-input:focus {
  border-color: var(--primary-color);
  background: var(--primary-light-bg, rgba(59, 130, 246, 0.05));
}

.search-input::placeholder {
  color: var(--text-secondary);
  opacity: 0.6;
}

/* 日志列表 */
.log-list {
  flex: 1;
  overflow-y: auto;
  font-family: 'SF Mono', 'Menlo', 'Monaco', 'Consolas', 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  contain: content;
}

.log-entry {
  display: flex;
  align-items: baseline;
  padding: 3px 16px;
  gap: 10px;
  border-bottom: 1px solid var(--divider-color);
}

.log-entry.log-error {
  background: rgba(239, 68, 68, 0.04);
}

.log-entry.log-warn {
  background: rgba(245, 158, 11, 0.04);
}

.log-time {
  color: var(--text-secondary);
  white-space: nowrap;
  min-width: 85px;
  flex-shrink: 0;
  opacity: 0.7;
}

.log-level-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 3px;
  white-space: nowrap;
  min-width: 42px;
  text-align: center;
  flex-shrink: 0;
}

.badge-error {
  background: #ef4444;
  color: white;
}

.badge-warn {
  background: #f59e0b;
  color: white;
}

.badge-info {
  background: #10b981;
  color: white;
}

.badge-debug {
  background: #6b7280;
  color: white;
}

.badge-verbose {
  background: #8b5cf6;
  color: white;
}

.log-source {
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
  min-width: 50px;
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.log-message {
  color: var(--text-color);
  word-break: break-all;
  flex: 1;
  user-select: text;
}

/* 空状态 */
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--text-secondary);
  font-size: 13px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* 未启用状态 */
.disabled-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--text-secondary);
}

.disabled-text {
  font-size: 14px;
  margin: 0;
}

/* 底部状态栏 */
.console-statusbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 16px;
  border-top: 1px solid var(--divider-color);
  font-size: 11px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.status-counts {
  display: flex;
  gap: 12px;
}

.count-item {
  font-weight: 500;
}

.count-error {
  color: #ef4444;
}

.count-warn {
  color: #f59e0b;
}

.count-info {
  color: var(--text-secondary);
}

.status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid var(--divider-color);
  background: var(--control-bg);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}

.status-btn:hover {
  background: var(--hover-bg);
}

.status-btn.active {
  background: #10b981;
  color: white;
  border-color: #10b981;
}

.live-indicator {
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 500;
}

.live-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: background 0.2s;
}

.live-indicator.active .live-dot {
  background: #10b981;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}
</style>
