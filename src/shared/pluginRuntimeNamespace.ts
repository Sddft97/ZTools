/**
 * 开发版插件名后缀。
 * 安装开发版插件时，其 name 会自动追加该后缀，以在数据库、Session 等所有隔离层中唯一区分。
 */
export const DEV_PLUGIN_SUFFIX = '__dev'

/**
 * 判断给定插件名是否为开发版（即以 `__dev` 结尾）。
 */
export function isDevelopmentPluginName(pluginName: string): boolean {
  return pluginName.endsWith(DEV_PLUGIN_SUFFIX)
}

/**
 * 将插件原始名转换为开发版名（追加 `__dev` 后缀）。
 */
export function toDevPluginName(originalName: string): string {
  return originalName + DEV_PLUGIN_SUFFIX
}

/**
 * 从开发版名还原原始插件名（去掉 `__dev` 后缀）。
 * 若传入名称不以 `__dev` 结尾，原样返回。
 */
export function fromDevPluginName(effectiveName: string): string {
  if (effectiveName.endsWith(DEV_PLUGIN_SUFFIX)) {
    return effectiveName.slice(0, -DEV_PLUGIN_SUFFIX.length)
  }
  return effectiveName
}

/**
 * 设置页"我的数据"所需的最小插件数据记录。
 */
export interface PluginDataRecord {
  /** 插件有效名称（开发版含 `__dev` 后缀）。 */
  pluginName: string
  /** 插件展示标题。 */
  pluginTitle: string | null
  /** 文档数量。 */
  docCount: number
  /** 附件数量。 */
  attachmentCount: number
  /** 插件图标。 */
  logo: string | null
  /** 是否为开发版，供界面直接渲染 DEV 标签。 */
  isDevelopment: boolean
}

/**
 * 生成插件私有数据库文档前缀。
 * pluginName 即有效名称（开发版已含 `__dev`），直接用作命名空间。
 */
export function getPluginDataPrefix(pluginName: string): string {
  return `PLUGIN/${pluginName}/`
}

/**
 * 生成插件私有文档的完整 `_id`。
 */
export function getPluginDocId(pluginName: string, key: string): string {
  return `PLUGIN/${pluginName}/${key}`
}

/**
 * 生成插件主视图与插件子窗口共享的 Session partition。
 */
export function getPluginSessionPartition(pluginName: string): string {
  return `persist:${pluginName}`
}

/**
 * 生成插件 zbrowser 专用 Session partition。
 */
export function getPluginZBrowserPartition(pluginName: string): string {
  return `${pluginName}.zbrowser`
}

/**
 * 分离窗口尺寸按插件有效名称持久化，避免开发版和安装版串用。
 */
export function getDetachedWindowSizeKey(pluginName: string): string {
  return pluginName
}
