import { app } from 'electron'
import path from 'path'

/**
 * 随包内置插件名称列表
 * 这些插件存在于 internal-plugins 目录，并由宿主在启动时自动装载。
 */
export const BUNDLED_INTERNAL_PLUGIN_NAMES = ['setting', 'system'] as const

/**
 * 内部 API 特权插件名称列表
 * 这些插件允许调用 window.ztools.internal，但不一定是随包内置插件。
 */
export const INTERNAL_API_PLUGIN_NAMES = [
  ...BUNDLED_INTERNAL_PLUGIN_NAMES,
  'zTools-developer-plugin__dev',
  'zTools-developer-plugin'
] as const

export type BundledInternalPluginName = (typeof BUNDLED_INTERNAL_PLUGIN_NAMES)[number]
export type InternalApiPluginName = (typeof INTERNAL_API_PLUGIN_NAMES)[number]

/**
 * 判断是否为随包内置插件
 * @param pluginName 插件名称
 * @returns 是否为随包内置插件
 */
export function isBundledInternalPlugin(pluginName: string): boolean {
  return BUNDLED_INTERNAL_PLUGIN_NAMES.includes(pluginName as BundledInternalPluginName)
}

/**
 * 判断插件是否允许调用内部 API
 * @param pluginName 插件名称
 * @returns 是否拥有内部 API 权限
 */
export function canPluginUseInternalApi(pluginName: string): boolean {
  return INTERNAL_API_PLUGIN_NAMES.includes(pluginName as InternalApiPluginName)
}

/**
 * 获取内置插件路径
 * @param pluginName 插件名称
 * @returns 插件路径
 */
export function getInternalPluginPath(pluginName: BundledInternalPluginName): string {
  const isDev = !app.isPackaged

  if (isDev) {
    // 开发环境：使用源码目录
    return path.resolve(process.cwd(), 'internal-plugins', pluginName)
  } else {
    // 生产环境：从 resources 加载
    return path.join(process.resourcesPath, 'app.asar.unpacked', 'internal-plugins', pluginName)
  }
}
