import { ipcMain } from 'electron'
import type { PluginManager } from '../../managers/pluginManager'

/**
 * HTTP API - 插件专用
 * 提供设置请求头的功能
 */
export class PluginHttpAPI {
  // 存储每个插件变体的请求头配置
  // key: runtimeNamespace, value: headers map
  private pluginHeaders: Map<string, Record<string, string>> = new Map()
  // 存储每个插件变体的拦截器监听器
  // key: runtimeNamespace, value: listener function
  private interceptors: Map<
    string,
    (
      details: Electron.OnBeforeSendHeadersListenerDetails,
      callback: (response: Electron.BeforeSendResponse) => void
    ) => void
  > = new Map()
  private pluginManager: PluginManager | null = null

  public init(pluginManager?: PluginManager): void {
    this.pluginManager = pluginManager ?? null
    this.setupIPC()
  }

  private setupIPC(): void {
    // 设置请求头
    ipcMain.on('http-set-headers', (event, headers: Record<string, string>) => {
      try {
        const runtimeNamespace = this.getPluginRuntimeNamespaceFromWebContents(event.sender)
        if (!runtimeNamespace) {
          event.returnValue = { success: false, error: '无法识别插件' }
          return
        }

        // 保存请求头配置
        this.pluginHeaders.set(runtimeNamespace, headers)

        // 获取插件的session
        const sess = event.sender.session

        // 移除旧的拦截器（如果存在）
        this.removeRequestInterceptor(runtimeNamespace, sess)

        // 设置新的请求拦截器
        const listener = this.setupRequestInterceptor(sess, headers)
        if (listener) {
          this.interceptors.set(runtimeNamespace, listener)
        }

        event.returnValue = { success: true }
      } catch (error: unknown) {
        console.error('[PluginHttp] 设置请求头失败:', error)
        event.returnValue = {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    // 获取当前请求头配置
    ipcMain.on('http-get-headers', (event) => {
      try {
        const runtimeNamespace = this.getPluginRuntimeNamespaceFromWebContents(event.sender)
        if (!runtimeNamespace) {
          event.returnValue = null
          return
        }

        const headers = this.pluginHeaders.get(runtimeNamespace) || {}
        event.returnValue = headers
      } catch (error: unknown) {
        console.error('[PluginHttp] 获取请求头失败:', error)
        event.returnValue = null
      }
    })

    // 清除请求头配置
    ipcMain.on('http-clear-headers', (event) => {
      try {
        const runtimeNamespace = this.getPluginRuntimeNamespaceFromWebContents(event.sender)
        if (!runtimeNamespace) {
          event.returnValue = { success: false, error: '无法识别插件' }
          return
        }

        // 移除请求头配置
        this.pluginHeaders.delete(runtimeNamespace)

        // 移除拦截器
        const sess = event.sender.session
        this.removeRequestInterceptor(runtimeNamespace, sess)

        event.returnValue = { success: true }
      } catch (error: unknown) {
        console.error('[PluginHttp] 清除请求头失败:', error)
        event.returnValue = {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })
  }

  /**
   * 从 WebContents 获取插件运行时命名空间。
   * 开发版与安装版必须使用不同 namespace，避免请求头配置串用。
   */
  private getPluginRuntimeNamespaceFromWebContents(
    webContents: Electron.WebContents
  ): string | null {
    try {
      if (this.pluginManager) {
        const pluginInfo = this.pluginManager.getPluginInfoByWebContents(webContents)
        if (pluginInfo) {
          return pluginInfo.name
        }
      }

      // 如果 pluginManager 不可用，尝试从 session partition 获取
      try {
        const sess = webContents.session
        // @ts-ignore - partition 属性可能不在类型定义中，但实际存在
        const partition = sess.partition

        // partition 格式: 'persist:<runtimeNamespace>'
        if (partition && typeof partition === 'string' && partition.startsWith('persist:')) {
          return partition.substring(8) // 移除 'persist:' 前缀
        }
      } catch {
        // 忽略错误
      }

      return null
    } catch (error) {
      console.error('[PluginHttp] 获取插件运行时命名空间失败:', error)
      return null
    }
  }

  /**
   * 设置请求拦截器
   * @returns 返回监听器函数
   */
  private setupRequestInterceptor(
    sess: Electron.Session,
    headers: Record<string, string>
  ):
    | ((
        details: Electron.OnBeforeSendHeadersListenerDetails,
        callback: (response: Electron.BeforeSendResponse) => void
      ) => void)
    | null {
    try {
      // 使用 onBeforeSendHeaders 拦截请求并修改请求头
      const listener = (
        details: Electron.OnBeforeSendHeadersListenerDetails,
        callback: (response: Electron.BeforeSendResponse) => void
      ): void => {
        // 合并用户设置的请求头
        const requestHeaders = {
          ...details.requestHeaders,
          ...headers
        }

        callback({
          requestHeaders
        })
      }

      sess.webRequest.onBeforeSendHeaders(
        {
          urls: ['http://*/*', 'https://*/*']
        },
        listener
      )

      return listener
    } catch (error) {
      console.error('[PluginHttp] 设置请求拦截器失败:', error)
      return null
    }
  }

  /**
   * 移除请求拦截器
   */
  private removeRequestInterceptor(runtimeNamespace: string, sess: Electron.Session): void {
    const listener = this.interceptors.get(runtimeNamespace)
    if (listener) {
      try {
        // 通过传递 null 作为 listener 来移除该监听器
        // 注意：这会移除该 session 的所有 onBeforeSendHeaders 监听器
        // 但由于每个插件都有独立的 session，这不会影响其他插件
        sess.webRequest.onBeforeSendHeaders(
          {
            urls: ['http://*/*', 'https://*/*']
          },
          null as any
        )
        this.interceptors.delete(runtimeNamespace)
      } catch (error) {
        console.warn('[PluginHttp] 移除请求拦截器失败:', error)
      }
    }
  }

  /**
   * 清理插件数据（当插件卸载时调用）
   */
  public cleanupPlugin(runtimeNamespace: string, sess?: Electron.Session): void {
    this.pluginHeaders.delete(runtimeNamespace)
    if (sess) {
      this.removeRequestInterceptor(runtimeNamespace, sess)
    }
  }
}

export default new PluginHttpAPI()
