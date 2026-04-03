/**
 * zbrowser 插件 API 注册
 *
 * 通过 registerPluginApiServices 注册到 plugin.api 统一分发器。
 *
 * API 列表：
 * - runZBrowser (异步): 执行 zbrowser 操作队列
 * - getIdleZBrowsers (同步): 获取空闲窗口列表
 * - setZBrowserProxy (异步): 设置代理 ⚠️ 破坏性变更
 * - clearZBrowserCache (异步): 清除缓存 ⚠️ 破坏性变更
 * - ubrowserLogin (异步): 兼容桩，返回 null
 */

import type { PluginManager } from '../../managers/pluginManager'
import { registerPluginApiServices } from './pluginApiDispatcher'
import zbrowserManager from '../../core/zbrowser/zbrowserManager'
import { ZBrowserExecutor } from '../../core/zbrowser/zbrowserExecutor'

/**
 * zbrowser API 模块
 */
export class ZBrowserAPI {
  private pluginManager: PluginManager | null = null

  public init(_mainWindow: Electron.BrowserWindow, pluginManager: PluginManager): void {
    this.pluginManager = pluginManager
    this.registerHandlers()
  }

  private registerHandlers(): void {
    const pluginManager = this.pluginManager!

    registerPluginApiServices({
      /**
       * 异步 API：执行 zbrowser 操作队列
       *
       * 创建 ZBrowserExecutor 实例，fork runner 子进程，
       * 在独立 BrowserWindow 中执行操作并返回结果。
       */
      runZBrowser: async (
        event: Electron.IpcMainInvokeEvent,
        { ubrowserId, options, queue }: { ubrowserId?: number; options: unknown; queue: unknown[] }
      ) => {
        const pluginInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        if (!pluginInfo) throw new Error('plugin not found')

        const executor = new ZBrowserExecutor()
        console.log('[zbrowser] 插件名:', {
          pluginName: pluginInfo.name,
          pluginPath: pluginInfo.path
        })
        return await executor.run({
          pluginName: pluginInfo.name,
          runtimeNamespace: pluginInfo.name,
          pluginLogo: pluginInfo.logo || '',
          ubrowserId,
          options: (options || {}) as any,
          queue: queue as any[],
          idleWindowIds: zbrowserManager.getIdleWindowIds(pluginInfo.name)
        })
      },

      /**
       * 同步 API：获取空闲窗口列表
       *
       * 返回 ZBrowserIdleWindowInfo[] 给插件（id、title、url）。
       */
      getIdleZBrowsers: (event: Electron.IpcMainEvent) => {
        const pluginInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        if (!pluginInfo) {
          event.returnValue = []
          return
        }
        event.returnValue = zbrowserManager.getIdleWindows(pluginInfo.name)
      },

      /**
       * 异步 API：设置代理
       *
       * ⚠️ 破坏性变更：uTools 为同步 sendSync 返回 boolean，
       * ZTools 改为 ipcInvoke 异步（因为 session.setProxy 是 Promise）。
       * 插件需改为 `await utools.setUBrowserProxy(config)`。
       */
      setZBrowserProxy: async (event: Electron.IpcMainInvokeEvent, config: unknown) => {
        const pluginInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        if (!pluginInfo) return false
        await zbrowserManager.setProxy(pluginInfo.name, config as Electron.ProxyConfig)
        return true
      },

      /**
       * 异步 API：清除缓存
       *
       * ⚠️ 破坏性变更：同上，uTools 为同步，ZTools 改为异步。
       */
      clearZBrowserCache: async (event: Electron.IpcMainInvokeEvent) => {
        const pluginInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        if (!pluginInfo) return false
        await zbrowserManager.clearCache(pluginInfo.name)
        return true
      },

      /**
       * 异步 API：ubrowserLogin 兼容桩
       *
       * uTools 实现：弹出 OAuth 登录窗口，返回用户登录凭证。
       * ZTools 暂不支持此功能，返回 null 并记录警告日志。
       */
      ubrowserLogin: async () => {
        console.warn('[zbrowser] ubrowserLogin is not supported in ZTools')
        return null
      }
    })

    console.log('[zbrowser] API 注册完成')
  }
}

export default new ZBrowserAPI()
