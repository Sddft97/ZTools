import { router } from '@/router'

/**
 * 跳转到已安装插件页面
 */
export interface PluginsSettingJumpFunction {
  /**
   * 安装开发插件
   */
  localAddDevPluginFilePath?: string
  /**
   * 自动打开详情的插件名称
   */
  autoOpenPluginName?: string
}

/**
 * 跳转到已安装插件页面
 * @param config 路由状态参数
 */
export function jumpFunctionPluginsSetting(config: PluginsSettingJumpFunction): void {
  void router.replace({
    name: 'Plugins',
    query: { _t: Date.now() },
    state: { ...config }
  })
}
