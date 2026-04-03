import { BrowserWindow, ipcMain, webContents } from 'electron'
import type { PluginManager } from '../../managers/pluginManager'
import pluginWindowManager, { winIpc } from '../../core/pluginWindowManager.js'
import windowManager from '../../managers/windowManager.js'
import detachedWindowManager from '../../core/detachedWindowManager.js'
import { registerPluginApiServices } from './pluginApiDispatcher'
import { getPluginSessionPartition } from '../../../shared/pluginRuntimeNamespace'

/**
 * 插件独立窗口管理API - 插件专用
 */
export class PluginWindowAPI {
  private pluginManager: PluginManager | null = null
  private mainWindow: Electron.BrowserWindow | null = null

  public init(mainWindow: Electron.BrowserWindow, pluginManager: PluginManager): void {
    this.pluginManager = pluginManager
    this.mainWindow = mainWindow
    this.setupIPC()
    this.registerPluginApiHandlers()
  }

  /**
   * 通过 plugin.api 统一通道注册 createBrowserWindow 相关 handler
   */
  private registerPluginApiHandlers(): void {
    const pluginManager = this.pluginManager!

    registerPluginApiServices({
      // ── 同步 API：创建窗口 ──
      createBrowserWindow: (
        event: Electron.IpcMainEvent,
        { url, options }: { url: string; options: Electron.BrowserWindowConstructorOptions }
      ) => {
        const pluginInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        if (!pluginInfo) {
          event.returnValue = new Error('plugin not found')
          return
        }

        // URL 安全校验不允许 http 访问
        if (url.startsWith('http')) {
          event.returnValue = new Error('The URL must be a local address starting with file://')
          return
        }

        const win = pluginWindowManager.createWindow(
          pluginInfo.path,
          pluginInfo.name,
          getPluginSessionPartition(pluginInfo.name),
          url,
          options,
          event.sender
        )

        // 返回白名单数组（与 utools 返回值结构一致）
        event.returnValue = {
          id: win.id,
          methods: winIpc.windowMethods,
          invokes: winIpc.windowInvokes,
          webContents: {
            id: win.webContents.id,
            methods: winIpc.webContentsMethods,
            invokes: winIpc.webContentsInvokes
          }
        }
      },

      // ── 同步 API：BrowserWindow/WebContents 同步方法分发 ──
      pluginBrowserWindowMethod: (
        event: Electron.IpcMainEvent,
        {
          id,
          target,
          method,
          args
        }: { id: number; target?: 'webContents'; method: string; args: any[] }
      ) => {
        const win = BrowserWindow.fromId(id)

        // 窗口不存在
        if (!win) {
          if (method === 'isDestroyed') {
            event.returnValue = true
            return
          }
          console.warn(`[pluginWindow:method] winId=${id} not found, method=${method}`)
          event.returnValue = new Error('window not exist')
          return
        }

        // 所有权校验（两级查找）：
        // 1. 先查主插件视图和分离窗口（pluginManager 管理）
        // 2. 再查子窗口（pluginWindowManager 管理，覆盖孙窗口嵌套场景）
        const callerInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        const callerPath =
          callerInfo?.path ?? pluginWindowManager.getPluginPathByWebContentsId(event.sender.id)
        const ownerPath = pluginWindowManager.getPluginPathByWindowId(id)

        if (!callerPath || callerPath !== ownerPath) {
          console.warn(`[pluginWindow:auth] pluginPath=${callerPath} denied access to winId=${id}`)
          event.returnValue = new Error('window id error')
          return
        }

        if (target === 'webContents') {
          if (!(winIpc.webContentsMethods as readonly string[]).includes(method)) {
            event.returnValue = new Error(`webContents function "${method}" not found`)
            return
          }
          try {
            event.returnValue = (win.webContents as any)[method](...args)
          } catch (e) {
            event.returnValue = e
          }
        } else {
          if (!(winIpc.windowMethods as readonly string[]).includes(method)) {
            event.returnValue = new Error(`BrowserWindow function "${method}" not found`)
            return
          }
          try {
            event.returnValue = (win as any)[method](...args)
          } catch (e) {
            event.returnValue = e
          }
        }
      },

      // ── 异步 API：BrowserWindow/WebContents 异步方法分发 ──
      pluginBrowserWindowInvoke: async (
        event: Electron.IpcMainInvokeEvent,
        {
          id,
          target,
          method,
          args
        }: { id: number; target?: 'webContents'; method: string; args: any[] }
      ) => {
        const win = BrowserWindow.fromId(id)
        if (!win) throw new Error('window not exist')

        // 所有权校验（两级查找）：
        // 1. 先查主插件视图和分离窗口（pluginManager 管理）
        // 2. 再查子窗口（pluginWindowManager 管理，覆盖孙窗口嵌套场景）
        const callerInfo = pluginManager.getPluginInfoByWebContents(event.sender)
        const callerPath =
          callerInfo?.path ?? pluginWindowManager.getPluginPathByWebContentsId(event.sender.id)
        const ownerPath = pluginWindowManager.getPluginPathByWindowId(id)

        if (!callerPath || callerPath !== ownerPath) {
          console.warn(`[pluginWindow:auth] pluginPath=${callerPath} denied access to winId=${id}`)
          throw new Error('window id error')
        }

        if (target === 'webContents') {
          // print 特殊处理：callback → Promise（与 utools 一致）
          if (method === 'print') {
            return new Promise((resolve, reject) => {
              win.webContents.print(args[0] || null, (success, failureReason) => {
                if (success) return resolve(undefined)
                reject(new Error('errorType ' + failureReason))
              })
            })
          }

          if (!(winIpc.webContentsInvokes as readonly string[]).includes(method)) {
            throw new Error(`webContents function "${method}" not found`)
          }
          return await (win.webContents as any)[method](...args)
        } else {
          if (!(winIpc.windowInvokes as readonly string[]).includes(method)) {
            throw new Error(`BrowserWindow function "${method}" not found`)
          }
          return await (win as any)[method](...args)
        }
      }
    })
  }

  private setupIPC(): void {
    // 发送消息到父窗口
    ipcMain.on('send-to-parent', (event, channel: string, ...args: any[]) => {
      pluginWindowManager.sendToParent(event.sender, channel, args)
    })

    // 显示主窗口
    ipcMain.handle('show-main-window', () => {
      windowManager.showWindow()
    })

    // 隐藏主窗口
    ipcMain.handle('hide-main-window', (_event, isRestorePreWindow: boolean = true) => {
      windowManager.hideWindow(isRestorePreWindow)
    })

    // ipcRenderer.sendTo polyfill
    ipcMain.on('ipc-send-to', (event, webContentsId: number, channel: string, ...args: any[]) => {
      const senderId = event.sender.id
      try {
        const targetWebContents = webContents.fromId(webContentsId)
        if (targetWebContents && !targetWebContents.isDestroyed()) {
          targetWebContents.send('__ipc_sendto_relay__', { senderId, channel, args })
        } else {
          console.warn(`[pluginWindow:method] 目标 webContents 不存在或已销毁: ${webContentsId}`)
        }
      } catch (error) {
        console.error('[pluginWindow:method] 转发消息失败:', error)
      }
    })

    // 获取窗口类型（同步方法，供插件使用）
    ipcMain.on('get-window-type', (event) => {
      try {
        const windowType = this.getWindowType(event.sender)
        event.returnValue = windowType
      } catch (error) {
        console.error('[pluginWindow:method] get-window-type error:', error)
        event.returnValue = 'main'
      }
    })
  }

  /**
   * 获取窗口类型
   * @param webContents 调用者的 WebContents
   * @returns 'main' | 'detach' | 'browser'
   */
  private getWindowType(webContents: Electron.WebContents): 'main' | 'detach' | 'browser' {
    // 检查是否是主窗口
    if (this.mainWindow && webContents.id === this.mainWindow.webContents.id) {
      return 'main'
    }

    // 检查是否是分离窗口
    if (detachedWindowManager.isDetachedWindow(webContents)) {
      return 'detach'
    }

    // 检查是否是 browser 窗口
    if (pluginWindowManager.isBrowserWindow(webContents)) {
      return 'browser'
    }

    // 默认返回 main（可能是插件的 WebContentsView）
    return 'main'
  }
}

export default new PluginWindowAPI()
