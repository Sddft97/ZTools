import databaseAPI from '../api/shared/database.js'
import { isDevelopmentPluginName, toDevPluginName } from '../../shared/pluginRuntimeNamespace.js'
import { isBundledInternalPlugin } from './internalPlugins.js'

/**
 * 将单个旧版 macOS .icns 图标 URL 迁移为直接使用 .app 路径的 ztools-icon URL
 */
function migrateLegacyMacAppIcon(item: { path?: string; icon?: string }): boolean {
  if (process.platform !== 'darwin') return false
  if (!item || typeof item.path !== 'string' || typeof item.icon !== 'string') return false
  if (!item.path.endsWith('.app') || !item.icon.startsWith('ztools-icon://')) return false

  const encodedPath = item.icon.replace('ztools-icon://', '')
  let decodedPath = ''
  try {
    decodedPath = decodeURIComponent(encodedPath)
  } catch {
    return false
  }

  if (!decodedPath.endsWith('.icns')) return false

  const nextIcon = `ztools-icon://${encodeURIComponent(item.path)}`
  if (item.icon === nextIcon) return false

  item.icon = nextIcon
  return true
}

/**
 * 递归迁移数组中的旧版 macOS 应用图标 URL
 */
function migrateLegacyMacAppIcons(items: any[]): boolean {
  if (process.platform !== 'darwin' || !Array.isArray(items)) return false

  let changed = false

  for (const item of items) {
    if (!item || typeof item !== 'object') continue

    if (migrateLegacyMacAppIcon(item)) {
      changed = true
    }

    if (Array.isArray(item.items) && migrateLegacyMacAppIcons(item.items)) {
      changed = true
    }
  }

  return changed
}

/**
 * 启动时统一迁移历史遗留数据
 * 当前仅处理旧版 macOS .icns 图标 URL 到 .app 路径图标 URL 的转换
 */
export function runStartupDataMigrations(): void {
  migrateDevPluginNames()
  migrateVariantRefLists()

  if (process.platform !== 'darwin') return

  const migrationKeys = [
    'command-history',
    'pinned-commands',
    'cached-commands',
    'local-shortcuts',
    'super-panel-pinned'
  ]

  for (const key of migrationKeys) {
    try {
      const data = databaseAPI.dbGet(key)
      if (!Array.isArray(data)) continue

      if (migrateLegacyMacAppIcons(data)) {
        databaseAPI.dbPut(key, data)
        console.log(`[StartupMigration] 已迁移旧版 macOS 图标数据: ${key}`)
      }
    } catch (error) {
      console.error(`[StartupMigration] 迁移失败: ${key}`, error)
    }
  }
}

/**
 * 将历史记录和固定列表中旧式开发版插件记录迁移为新格式。
 *
 * 旧格式：{ pluginName: 'demo', pluginSource: 'development' }
 * 新格式：{ pluginName: 'demo__dev' }  (移除 pluginSource 字段)
 *
 * 迁移策略：
 * - 若 pluginSource === 'development'，将 pluginName 加上 __dev 后缀
 * - 否则保持不变，仅移除 pluginSource 字段
 */
function migrateDevPluginNames(): void {
  const targetKeys = ['command-history', 'pinned-commands', 'super-panel-pinned']

  for (const key of targetKeys) {
    try {
      const data: any[] = databaseAPI.dbGet(key) || []
      if (!Array.isArray(data)) continue

      let changed = false
      for (const item of data) {
        if (item?.type !== 'plugin') continue

        // 将旧式 { pluginName, pluginSource: 'development' } 迁移为 __dev 后缀
        // 内置插件（setting、system）在开发模式下以 isDevelopment: true 存储但不加后缀，迁移时跳过
        // 仅当 pluginName 尚未含 __dev 后缀时才追加，避免新格式数据被重复迁移
        if (item.pluginSource === 'development' && typeof item.pluginName === 'string') {
          if (
            !isBundledInternalPlugin(item.pluginName) &&
            !isDevelopmentPluginName(item.pluginName)
          ) {
            item.pluginName = toDevPluginName(item.pluginName)
          }
          changed = true
        }
        // 移除 pluginSource 字段（已不再需要）
        if ('pluginSource' in item) {
          delete item.pluginSource
          changed = true
        }
      }

      if (changed) {
        databaseAPI.dbPut(key, data)
        console.log(`[StartupMigration] 已迁移开发版插件名称: ${key}`)
      }
    } catch (error) {
      console.error(`[StartupMigration] 开发版插件名称迁移失败: ${key}`, error)
    }
  }
}

/**
 * 将 autoStartPlugin / outKillPlugin / autoDetachPlugin 中旧式对象格式迁移为新式字符串格式。
 *
 * 旧格式：[{ pluginName: 'demo', source: 'development' }, {pluginName: 'foo', source: 'installed'}, ...]
 * 新格式：['demo__dev', 'foo', ...]
 */
function migrateVariantRefLists(): void {
  const configKeys = ['autoStartPlugin', 'outKillPlugin', 'autoDetachPlugin']

  for (const key of configKeys) {
    try {
      const data: any[] = databaseAPI.dbGet(key) || []
      if (!Array.isArray(data)) continue

      let changed = false
      const migrated: string[] = data
        .map((item) => {
          if (typeof item === 'string') return item
          if (item && typeof item === 'object' && typeof item.pluginName === 'string') {
            changed = true
            const isDev = item.source === 'development' || item.pluginSource === 'development'
            // 内置插件不加 __dev 后缀
            if (isDev && !isBundledInternalPlugin(item.pluginName)) {
              return toDevPluginName(item.pluginName)
            }
            return item.pluginName
          }
          return null
        })
        .filter(Boolean) as string[]

      if (changed || migrated.length !== data.length) {
        databaseAPI.dbPut(key, migrated)
        console.log(`[StartupMigration] 已迁移插件配置列表: ${key}`)
      }
    } catch (error) {
      console.error(`[StartupMigration] 迁移插件配置列表失败: ${key}`, error)
    }
  }
}
