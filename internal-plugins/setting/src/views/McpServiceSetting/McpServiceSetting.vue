<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useToast, DetailPanel } from '@/components'

const { success, error } = useToast()

const MCP_PORT = 36579
const MCP_DISABLED_PLUGINS_KEY = 'settings-mcp-disabled-plugins'

interface McpToolEntry {
  pluginName: string
  pluginPath: string
  pluginLogo?: string
  toolName: string
  mcpName: string
  description: string
  inputSchema: Record<string, unknown>
  outputSchema?: Record<string, unknown>
  enabled: boolean
}

interface McpPluginGroup {
  pluginName: string
  pluginPath: string
  pluginLogo?: string
  enabled: boolean
  tools: McpToolEntry[]
}

const enabled = ref(false)
const apiKey = ref('')
const running = ref(false)
const mcpTools = ref<McpToolEntry[]>([])
const expandedPluginPath = ref('')
const savingPluginPath = ref('')
const selectedTool = ref<McpToolEntry | null>(null)

const mcpEndpoint = computed(() => `http://127.0.0.1:${MCP_PORT}/mcp`)
const mcpEndpointWithKey = computed(
  () => `${mcpEndpoint.value}?key=${encodeURIComponent(apiKey.value)}`
)
const selectedToolJson = computed(() => {
  if (!selectedTool.value) return ''
  return JSON.stringify(
    {
      description: selectedTool.value.description,
      inputSchema: selectedTool.value.inputSchema,
      outputSchema: selectedTool.value.outputSchema
    },
    null,
    2
  )
})

const pluginGroups = computed<McpPluginGroup[]>(() => {
  const groups = new Map<string, McpPluginGroup>()

  for (const tool of [...mcpTools.value].sort((a, b) => a.mcpName.localeCompare(b.mcpName))) {
    const current = groups.get(tool.pluginPath)
    if (current) {
      current.tools.push(tool)
      continue
    }

    groups.set(tool.pluginPath, {
      pluginName: tool.pluginName,
      pluginPath: tool.pluginPath,
      pluginLogo: tool.pluginLogo,
      enabled: tool.enabled,
      tools: [tool]
    })
  }

  return [...groups.values()].sort((a, b) => a.pluginName.localeCompare(b.pluginName))
})

async function copyText(text: string, message: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
    success(message)
  } catch {
    error('复制失败')
  }
}

async function loadConfig(): Promise<void> {
  try {
    const [configResult, statusResult, toolsResult] = await Promise.all([
      window.ztools.internal.mcpServerGetConfig(),
      window.ztools.internal.mcpServerStatus(),
      window.ztools.internal.mcpServerTools()
    ])

    if (configResult.success && configResult.config) {
      enabled.value = configResult.config.enabled
      apiKey.value = configResult.config.apiKey
    }
    if (statusResult.success) {
      running.value = statusResult.running ?? false
    }
    if (toolsResult.success) {
      mcpTools.value = toolsResult.data || []
    }
  } catch (err) {
    console.error('加载 MCP 服务配置失败:', err)
  }
}

async function saveConfig(): Promise<void> {
  try {
    const result = await window.ztools.internal.mcpServerSaveConfig({
      enabled: enabled.value,
      port: MCP_PORT,
      apiKey: apiKey.value
    })

    if (!result.success) {
      error(`保存失败：${result.error}`)
      return
    }

    if (result.config) {
      apiKey.value = result.config.apiKey
    }

    const statusResult = await window.ztools.internal.mcpServerStatus()
    running.value = statusResult.success ? (statusResult.running ?? false) : false
  } catch (err: unknown) {
    error(`保存失败：${err instanceof Error ? err.message : '未知错误'}`)
  }
}

async function handleServiceToggle(): Promise<void> {
  await saveConfig()
}

async function togglePlugin(plugin: McpPluginGroup, value: boolean): Promise<void> {
  try {
    savingPluginPath.value = plugin.pluginPath
    const current = await window.ztools.internal.dbGet(MCP_DISABLED_PLUGINS_KEY)
    const disabled = new Set<string>(
      Array.isArray(current) ? current.filter((item: unknown) => typeof item === 'string') : []
    )

    if (value) {
      disabled.delete(plugin.pluginPath)
    } else {
      disabled.add(plugin.pluginPath)
    }

    await window.ztools.internal.dbPut(MCP_DISABLED_PLUGINS_KEY, [...disabled])
    await loadConfig()
  } catch (err: unknown) {
    error(`更新插件状态失败：${err instanceof Error ? err.message : '未知错误'}`)
  } finally {
    savingPluginPath.value = ''
  }
}

function handlePluginToggle(plugin: McpPluginGroup, event: Event): void {
  const target = event.target
  if (!(target instanceof HTMLInputElement)) return
  togglePlugin(plugin, target.checked)
}

function togglePluginExpand(pluginPath: string): void {
  expandedPluginPath.value = expandedPluginPath.value === pluginPath ? '' : pluginPath
}

function openToolDetail(tool: McpToolEntry): void {
  selectedTool.value = tool
}

function closeToolDetail(): void {
  selectedTool.value = null
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="content-panel">
    <Transition name="list-slide">
      <div v-show="!selectedTool" class="scrollable-content">
        <h2 class="section-title">MCP 服务</h2>
        <p class="section-desc">
          使用固定端口 {{ MCP_PORT }} 对外暴露插件工具，复制后的地址会自动拼上访问密钥。
        </p>

        <div class="setting-item">
          <div class="setting-label">
            <span>启用 MCP 服务</span>
            <span class="setting-desc">开启后外部 MCP 客户端可连接并调用插件工具</span>
          </div>
          <label class="toggle">
            <input v-model="enabled" type="checkbox" @change="handleServiceToggle" />
            <span class="toggle-slider"></span>
          </label>
        </div>

        <div v-if="enabled" class="service-config">
          <div class="setting-item">
            <label class="setting-label">服务地址</label>
            <div class="address-row">
              <code class="mono-text">{{ mcpEndpoint }}</code>
              <button
                class="btn btn-primary btn-sm"
                @click="copyText(mcpEndpointWithKey, '带密钥地址已复制')"
              >
                复制
              </button>
            </div>
          </div>

          <div class="status-bar">
            <span class="status-dot" :class="{ active: running }"></span>
            <span class="status-text">{{ running ? '服务运行中' : '服务未启动' }}</span>
          </div>

          <h3 class="subsection-title">
            支持 MCP 的插件
            <span class="count-badge">{{ pluginGroups.length }}</span>
          </h3>
          <p class="subsection-desc">关闭某个插件后，它的所有 MCP 工具都会从服务端隐藏。</p>

          <div v-if="pluginGroups.length" class="plugin-list">
            <div v-for="plugin in pluginGroups" :key="plugin.pluginPath" class="plugin-item">
              <button
                class="plugin-head"
                type="button"
                @click="togglePluginExpand(plugin.pluginPath)"
              >
                <div class="plugin-left">
                  <svg
                    class="expand-icon"
                    :class="{ expanded: expandedPluginPath === plugin.pluginPath }"
                    width="12"
                    height="12"
                    viewBox="0 0 12 12"
                    fill="none"
                  >
                    <path
                      d="M4.5 2.5L8 6L4.5 9.5"
                      stroke="currentColor"
                      stroke-width="1.5"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                  <img
                    v-if="plugin.pluginLogo"
                    :src="plugin.pluginLogo"
                    :alt="plugin.pluginName"
                    class="plugin-logo"
                  />
                  <div v-else class="plugin-logo plugin-logo-fallback">
                    {{ plugin.pluginName.slice(0, 1) }}
                  </div>
                  <div class="plugin-info">
                    <span class="plugin-name">{{ plugin.pluginName }}</span>
                    <span class="plugin-meta"
                      >{{ plugin.tools.length }} 个工具 ·
                      {{ plugin.enabled ? '已暴露' : '已禁用' }}</span
                    >
                  </div>
                </div>
                <label class="toggle" @click.stop>
                  <input
                    :checked="plugin.enabled"
                    :disabled="savingPluginPath === plugin.pluginPath"
                    type="checkbox"
                    @change="handlePluginToggle(plugin, $event)"
                  />
                  <span class="toggle-slider"></span>
                </label>
              </button>

              <div class="plugin-tools" :class="{ open: expandedPluginPath === plugin.pluginPath }">
                <div class="plugin-tools-inner">
                  <div v-for="tool in plugin.tools" :key="tool.mcpName" class="tool-item">
                    <div class="tool-top">
                      <div class="tool-names">
                        <code class="tool-mcp-name">{{ tool.mcpName }}</code>
                        <code class="tool-original-name">{{ tool.toolName }}</code>
                      </div>
                      <button class="btn btn-sm" @click="openToolDetail(tool)">详情</button>
                    </div>
                    <p class="tool-desc">{{ tool.description }}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="empty-state">当前没有插件声明 MCP 工具</div>
        </div>
      </div>
    </Transition>

    <Transition name="slide">
      <DetailPanel v-if="selectedTool" :title="selectedTool.toolName" @back="closeToolDetail">
        <div class="tool-detail-content">
          <div class="tool-detail-card">
            <div class="tool-detail-header">
              <code class="tool-mcp-name">{{ selectedTool.mcpName }}</code>
              <p class="subsection-desc">{{ selectedTool.pluginName }} 的 MCP 工具 JSON 描述</p>
            </div>
            <pre class="tool-json">{{ selectedToolJson }}</pre>
          </div>
        </div>
      </DetailPanel>
    </Transition>
  </div>
</template>

<style scoped>
.content-panel {
  height: 100%;
  overflow: hidden;
  position: relative;
  background: var(--bg-color);
}

.scrollable-content {
  position: absolute;
  inset: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 20px;
}

.list-slide-enter-active,
.list-slide-leave-active {
  transition:
    transform 0.2s ease,
    opacity 0.15s ease;
}

.list-slide-enter-from,
.list-slide-leave-to {
  transform: translateX(-100%);
  opacity: 0;
}

.section-title {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 8px 0;
}

.section-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 24px 0;
}

.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.setting-label {
  font-size: 14px;
  color: var(--text-color);
  font-weight: 500;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.setting-desc {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 400;
}

.service-config {
  margin-top: 24px;
  padding-top: 24px;
  border-top: 1px solid var(--divider-color);
}

.service-config .setting-item {
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.address-row {
  display: flex;
  gap: 8px;
  width: 100%;
  align-items: center;
}

.mono-text {
  flex: 1;
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 13px;
  padding: 8px 12px;
  background: var(--hover-bg);
  border-radius: 6px;
  color: var(--text-color);
  word-break: break-all;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
  padding: 10px 14px;
  background: var(--hover-bg);
  border-radius: 8px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-secondary);
  transition: background 0.3s;
  flex-shrink: 0;
}

.status-dot.active {
  background: var(--success-color, #34c759);
  box-shadow: 0 0 6px var(--success-color, #34c759);
}

.status-text {
  font-size: 13px;
  color: var(--text-secondary);
}

.subsection-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-color);
  margin: 0 0 6px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.count-badge {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--hover-bg);
  padding: 2px 8px;
  border-radius: 4px;
}

.subsection-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 16px 0;
}

.plugin-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.plugin-item {
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--card-bg);
  overflow: hidden;
}

.plugin-head {
  width: 100%;
  padding: 12px 14px;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
}

.plugin-left {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.expand-icon {
  color: var(--text-secondary);
  flex-shrink: 0;
  transition: transform 0.2s ease;
}

.expand-icon.expanded {
  transform: rotate(90deg);
}

.plugin-logo {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  object-fit: cover;
  flex-shrink: 0;
}

.plugin-logo-fallback {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--hover-bg);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.plugin-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.plugin-name {
  color: var(--text-color);
  font-size: 14px;
  font-weight: 500;
}

.plugin-meta {
  color: var(--text-secondary);
  font-size: 12px;
}

.plugin-tools {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.25s ease;
}

.plugin-tools.open {
  grid-template-rows: 1fr;
}

.plugin-tools-inner {
  overflow: hidden;
  min-height: 0;
}

.plugin-tools.open .plugin-tools-inner {
  padding: 12px 14px 14px;
  border-top: 1px solid var(--divider-color);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tool-item {
  padding: 10px 12px;
  background: var(--hover-bg);
  border-radius: 6px;
}

.tool-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.tool-names {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.tool-mcp-name,
.tool-original-name {
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
}

.tool-mcp-name {
  color: var(--text-color);
}

.tool-original-name {
  color: var(--text-secondary);
}

.tool-desc {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.tool-detail-content {
  padding: 20px;
}

.tool-detail-card {
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  background: var(--card-bg);
  overflow: hidden;
}

.tool-detail-header {
  padding: 14px;
  border-bottom: 1px solid var(--divider-color);
}

.tool-json {
  margin: 0;
  padding: 14px;
  font-family: 'SF Mono', 'Menlo', 'Monaco', monospace;
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-color);
  white-space: pre-wrap;
  word-break: break-word;
}

.empty-state {
  padding: 20px;
  border-radius: 8px;
  background: var(--hover-bg);
  color: var(--text-secondary);
  text-align: center;
  font-size: 13px;
}
</style>
