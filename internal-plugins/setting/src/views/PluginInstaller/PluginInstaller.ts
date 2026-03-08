import { router } from '@/router'

export interface PluginInstallerJumpFunction {
  /**
   * 安装路径
   */
  installFilePath?: string
}

/**
 * 跳转到插件安装页面
 * @param config 路由状态参数
 */
export function jumpFunctionPluginInstaller(config: PluginInstallerJumpFunction): void {
  void router.replace({
    name: 'PluginInstaller',
    query: { _t: Date.now() },
    state: { ...config }
  })
}
