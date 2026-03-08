import { router } from '@/router'

/**
 * 跳转到插件市场页面参数
 */
export interface PluginMarketSettingJumpFunction {
  /**
   * 自动打开详情的插件名称
   */
  autoOpenPluginName?: string
}

/**
 * 跳转到插件市场页面
 * @param config 路由状态参数
 */
export function jumpFunctionPluginMarketSetting(config: PluginMarketSettingJumpFunction): void {
  void router.replace({
    name: 'Market',
    query: { _t: Date.now() },
    state: { ...config }
  })
}
