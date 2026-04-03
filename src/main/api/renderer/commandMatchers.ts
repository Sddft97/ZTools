/**
 * 指令匹配纯函数
 * 提取自 commands.ts 中的匹配逻辑，便于单元测试
 */

/**
 * 在列表中查找匹配项的索引
 * 插件类型优先按 pluginName（唯一，开发版含 __dev 后缀）匹配；非插件类型匹配 name + path
 */
export function findCommandIndex(
  list: any[],
  appPath: string,
  type: string,
  featureCode?: string,
  name?: string
): number {
  return list.findIndex((item) => {
    if (item.type === 'plugin' && type === 'plugin') {
      if (item.featureCode !== featureCode) {
        return false
      }
      // 优先按 pluginName 匹配（已含 __dev，唯一标识）
      if (name && item.pluginName) {
        return item.pluginName === name
      }
      return item.path === appPath
    }
    // 非插件类型：优先匹配 name + path，兼容旧数据（name 缺失时降级为仅匹配 path）
    if (name) {
      return item.path === appPath && item.name === name
    }
    return item.path === appPath
  })
}

/**
 * 过滤掉匹配项（用于 removeFromHistory / unpinApp）
 * 插件类型优先按 pluginName 匹配；非插件类型匹配 name + path
 */
export function filterOutCommand(
  list: any[],
  appPath: string,
  featureCode?: string,
  name?: string
): any[] {
  return list.filter((item) => {
    if (item.type === 'plugin' && featureCode !== undefined) {
      if (item.featureCode !== featureCode) {
        return true
      }
      if (name && item.pluginName) {
        return item.pluginName !== name
      }
      return item.path !== appPath
    }
    // 非插件类型：同时匹配 name 和 path
    if (name) {
      return !(item.path === appPath && item.name === name)
    }
    return item.path !== appPath
  })
}

/**
 * 检查列表中是否已存在匹配项（用于 pinApp）
 * 插件类型优先按 pluginName 匹配；非插件类型匹配 name + path
 */
export function hasCommand(
  list: any[],
  appPath: string,
  featureCode?: string,
  name?: string
): boolean {
  return list.some((item) => {
    if (item.type === 'plugin' && featureCode !== undefined) {
      if (item.featureCode !== featureCode) {
        return false
      }
      if (name && item.pluginName) {
        return item.pluginName === name
      }
      return item.path === appPath
    }
    // 非插件类型：优先匹配 name + path，兼容旧数据（name 缺失时降级为仅匹配 path）
    if (name) {
      return item.path === appPath && item.name === name
    }
    return item.path === appPath
  })
}
