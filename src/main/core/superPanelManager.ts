import { BrowserWindow, clipboard, ipcMain, screen } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import plist from 'simple-plist'
import { is } from '@electron-toolkit/utils'
import { ClipboardMonitor, MouseMonitor, WindowManager } from './native/index.js'
import databaseAPI from '../api/shared/database.js'
import windowManager from '../managers/windowManager.js'
import { applyWindowMaterial, getDefaultWindowMaterial } from '../utils/windowUtils.js'

// 超级面板窗口尺寸
const SUPER_PANEL_WIDTH = 250
const SUPER_PANEL_HEIGHT = 400

// 模拟复制后等待剪贴板更新的时间
const CLIPBOARD_WAIT_MS = 50

// 剪贴板内容类型
interface ClipboardContent {
  type: 'text' | 'image' | 'file'
  text?: string
  image?: string // base64
  files?: Array<{ path: string; name: string; isDirectory: boolean }>
}

interface SuperPanelConfig {
  enabled: boolean
  mouseButton: 'middle' | 'right' | 'back' | 'forward'
  longPressMs: number
}

/**
 * 超级面板管理器
 * 负责鼠标监听、模拟复制、创建超级面板窗口、与主窗口通信搜索
 */
class SuperPanelManager {
  private superPanelWindow: BrowserWindow | null = null
  private mainWindow: BrowserWindow | null = null
  private windowReady = false
  private pendingMessages: Array<{ channel: string; data: any }> = []
  private config: SuperPanelConfig = {
    enabled: false,
    mouseButton: 'middle',
    longPressMs: 500
  }

  /**
   * 初始化超级面板管理器
   */
  init(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow
    this.setupIPC()
    this.loadConfig()
  }

  /**
   * 从数据库加载配置并启动监听
   */
  private async loadConfig(): Promise<void> {
    try {
      const data = await databaseAPI.dbGet('settings-general')
      if (data) {
        this.config = {
          enabled: data.superPanelEnabled ?? false,
          mouseButton: data.superPanelMouseButton ?? 'middle',
          longPressMs: data.superPanelLongPressMs ?? 500
        }
        if (this.config.enabled) {
          this.startMonitor()
        }
        console.log('[SuperPanel] 超级面板配置已加载:', this.config)
      }
    } catch (error) {
      console.error('[SuperPanel] 加载超级面板配置失败:', error)
    }
  }

  /**
   * 设置变更时调用（从设置页面触发）
   */
  updateConfig(config: { enabled: boolean; mouseButton: string; longPressMs: number }): void {
    this.config = {
      enabled: config.enabled,
      mouseButton: config.mouseButton as SuperPanelConfig['mouseButton'],
      longPressMs: config.longPressMs
    }

    if (this.config.enabled) {
      this.startMonitor()
    } else {
      this.stopMonitor()
      this.hideWindow()
    }

    console.log('[SuperPanel] 超级面板配置已更新:', this.config)
  }

  /**
   * 启动鼠标监听
   */
  private startMonitor(): void {
    // 先停止已有的监听
    if (MouseMonitor.isMonitoring) {
      MouseMonitor.stop()
    }

    try {
      MouseMonitor.start(this.config.mouseButton, this.config.longPressMs, () => {
        this.onMouseTrigger()
      })
      console.log(
        `[SuperPanel] 超级面板鼠标监听已启动: ${this.config.mouseButton}, ${this.config.longPressMs}ms`
      )
    } catch (error) {
      console.error('[SuperPanel] 启动超级面板鼠标监听失败:', error)
    }
  }

  /**
   * 停止鼠标监听
   */
  private stopMonitor(): void {
    if (MouseMonitor.isMonitoring) {
      MouseMonitor.stop()
      console.log('[SuperPanel] 超级面板鼠标监听已停止')
    }
  }

  // 当前剪贴板内容（在模拟复制后读取）
  private currentClipboardContent: ClipboardContent | null = null

  /**
   * 读取剪贴板内容（支持文件、图片、文字三种类型）
   */
  private readClipboardContent(): ClipboardContent | null {
    try {
      // 优先检测文件
      if (os.platform() === 'darwin') {
        if (clipboard.has('NSFilenamesPboardType')) {
          try {
            const result = clipboard.read('NSFilenamesPboardType')
            if (result) {
              const filePaths = plist.parse(result) as string[]
              if (Array.isArray(filePaths) && filePaths.length > 0) {
                const files = filePaths.map((filePath: string) => {
                  let isDirectory = false
                  try {
                    isDirectory = fs.statSync(filePath).isDirectory()
                  } catch {
                    // ignore
                  }
                  return {
                    path: filePath,
                    name: path.basename(filePath),
                    isDirectory
                  }
                })
                return { type: 'file', files }
              }
            }
          } catch (error) {
            console.error('[SuperPanel] 读取文件剪贴板失败:', error)
          }
        }
      } else if (os.platform() === 'win32') {
        try {
          const files = ClipboardMonitor.getClipboardFiles()
          if (Array.isArray(files) && files.length > 0) {
            return { type: 'file', files }
          }
        } catch (error) {
          console.error('[SuperPanel] 读取文件剪贴板失败:', error)
        }
      }

      // 检测图片
      const image = clipboard.readImage()
      if (!image.isEmpty()) {
        const buffer = image.toPNG()
        const base64 = `data:image/png;base64,${buffer.toString('base64')}`
        return { type: 'image', image: base64 }
      }

      // 检测文本
      const text = clipboard.readText()
      if (text && text.trim() !== '') {
        return { type: 'text', text }
      }

      return null
    } catch (error) {
      console.error('[SuperPanel] 读取剪贴板失败:', error)
      return null
    }
  }

  /**
   * 鼠标触发回调
   */
  private async onMouseTrigger(): Promise<void> {
    try {
      // 1. 记录鼠标位置
      const cursorPoint = screen.getCursorScreenPoint()

      // 2. 记录当前剪贴板内容快照（用于对比是否有新内容）
      const oldContent = this.readClipboardContent()
      const oldClipboardText = clipboard.readText()

      // 3. 等待鼠标按键释放
      // await new Promise((resolve) => setTimeout(resolve, 100))

      // 4. 模拟复制（Cmd+C on macOS, Ctrl+C on Windows）
      const modifier = process.platform === 'darwin' ? 'meta' : 'ctrl'
      WindowManager.simulateKeyboardTap('c', modifier)

      // 5. 等待剪贴板更新
      await new Promise((resolve) => setTimeout(resolve, CLIPBOARD_WAIT_MS))

      // 6. 读取新的剪贴板内容（支持文件/图片/文字）
      const newContent = this.readClipboardContent()
      const newClipboardText = clipboard.readText()

      // 7. 判断是否有新的复制内容
      let hasNewContent = false
      if (newContent) {
        if (newContent.type === 'text') {
          hasNewContent = newClipboardText !== oldClipboardText && newClipboardText.trim() !== ''
        } else if (newContent.type === 'file') {
          // 文件：对比文件路径列表
          const oldPaths = oldContent?.files?.map((f) => f.path).join('|') || ''
          const newPaths = newContent.files?.map((f) => f.path).join('|') || ''
          hasNewContent = newPaths !== oldPaths && newPaths !== ''
        } else if (newContent.type === 'image') {
          // 图片：只要有图片就认为有新内容（无法精确对比）
          hasNewContent = !oldContent || oldContent.type !== 'image'
        }
      }

      // 8. 保存当前剪贴板内容
      this.currentClipboardContent = hasNewContent ? newContent : null

      // 9. 显示超级面板窗口
      this.showWindow(cursorPoint.x, cursorPoint.y)

      // 10. 根据剪贴板内容决定模式
      if (hasNewContent && newContent) {
        // 有新内容：发送搜索请求到主窗口（携带剪贴板类型和数据）
        this.requestSearch(newContent)
      } else {
        // 无新内容：加载固定列表
        this.loadPinnedCommands()
      }
    } catch (error) {
      console.error('[SuperPanel] 超级面板触发失败:', error)
    }
  }

  /**
   * 创建超级面板窗口
   */
  private createWindow(x: number, y: number): BrowserWindow {
    // 新窗口，标记未就绪
    this.windowReady = false
    this.pendingMessages = []

    // 计算窗口位置（防止超出屏幕）
    const { position } = this.adjustPosition(x, y)

    const windowConfig: Electron.BrowserWindowConstructorOptions = {
      width: SUPER_PANEL_WIDTH,
      height: SUPER_PANEL_HEIGHT,
      x: position.x,
      y: position.y,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      show: false,
      hasShadow: true,
      type: 'panel',
      webPreferences: {
        preload: path.join(__dirname, '../preload/index.js'),
        backgroundThrottling: false,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        webSecurity: false
      }
    }

    // macOS 系统配置
    if (process.platform === 'darwin') {
      windowConfig.transparent = true
      windowConfig.vibrancy = 'fullscreen-ui'
    }
    // Windows 系统配置（不设置 transparent，让 setBackgroundMaterial 生效）
    else if (process.platform === 'win32') {
      windowConfig.backgroundColor = '#00000000'
    }

    const win = new BrowserWindow(windowConfig)

    // macOS: 不在 Dock 中显示
    if (process.platform === 'darwin') {
      win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    }

    // 同步窗口材质（Windows）
    if (process.platform === 'win32') {
      this.applyMaterialToWindow(win)
    }

    // 加载超级面板页面（使用独立的 HTML 入口）
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/super-panel.html`)
    } else {
      win.loadFile(path.join(__dirname, '../renderer/super-panel.html'))
    }

    // 窗口加载完成后显示
    win.once('ready-to-show', () => {
      win.show()
    })

    // 失去焦点时关闭
    win.on('blur', () => {
      this.hideWindow()
    })

    // 窗口关闭时清理引用
    win.on('closed', () => {
      this.superPanelWindow = null
      this.windowReady = false
      this.pendingMessages = []
    })

    return win
  }

  /**
   * 调整窗口位置，防止超出屏幕边界
   */
  private adjustPosition(x: number, y: number): { position: { x: number; y: number } } {
    const display = screen.getDisplayNearestPoint({ x, y })
    const { workArea } = display

    let adjustedX = x
    let adjustedY = y

    // 右边溢出
    if (adjustedX + SUPER_PANEL_WIDTH > workArea.x + workArea.width) {
      adjustedX = workArea.x + workArea.width - SUPER_PANEL_WIDTH
    }
    // 左边溢出
    if (adjustedX < workArea.x) {
      adjustedX = workArea.x
    }
    // 下边溢出
    if (adjustedY + SUPER_PANEL_HEIGHT > workArea.y + workArea.height) {
      adjustedY = workArea.y + workArea.height - SUPER_PANEL_HEIGHT
    }
    // 上边溢出
    if (adjustedY < workArea.y) {
      adjustedY = workArea.y
    }

    return { position: { x: adjustedX, y: adjustedY } }
  }

  /**
   * 显示超级面板窗口
   */
  private showWindow(x: number, y: number): void {
    if (this.superPanelWindow && !this.superPanelWindow.isDestroyed()) {
      // 复用已有窗口：更新位置并显示
      const { position } = this.adjustPosition(x, y)
      this.superPanelWindow.setPosition(position.x, position.y)
      this.superPanelWindow.show()
      this.superPanelWindow.focus()
    } else {
      // 创建新窗口
      this.superPanelWindow = this.createWindow(x, y)
    }
  }

  /**
   * 从数据库读取材质设置并应用到指定窗口
   */
  private async applyMaterialToWindow(win: BrowserWindow): Promise<void> {
    try {
      const settings = await databaseAPI.dbGet('settings-general')
      const material = settings?.windowMaterial || getDefaultWindowMaterial()
      applyWindowMaterial(win, material)
      // 通知超级面板渲染进程更新样式
      win.webContents.send('update-window-material', material)
    } catch (error) {
      console.error('[SuperPanel] 应用窗口材质失败:', error)
    }
  }

  /**
   * 更新超级面板窗口材质（由 windowManager 广播时调用）
   */
  updateWindowMaterial(material: 'mica' | 'acrylic' | 'none'): void {
    if (!this.superPanelWindow || this.superPanelWindow.isDestroyed()) return
    applyWindowMaterial(this.superPanelWindow, material)
    this.superPanelWindow.webContents.send('update-window-material', material)
  }

  /**
   * 向超级面板窗口广播消息（公共方法，供外部模块调用）
   */
  broadcastToSuperPanel(channel: string, data: any): void {
    if (this.superPanelWindow && !this.superPanelWindow.isDestroyed()) {
      this.superPanelWindow.webContents.send(channel, data)
    }
  }

  /**
   * 隐藏超级面板窗口
   */
  hideWindow(): void {
    if (this.superPanelWindow && !this.superPanelWindow.isDestroyed()) {
      this.superPanelWindow.hide()
    }
  }

  /**
   * 请求主窗口执行搜索（携带剪贴板内容类型和数据）
   */
  private requestSearch(content: ClipboardContent): void {
    if (!this.mainWindow || this.mainWindow.isDestroyed()) {
      return
    }

    // 搜索文本：文本类型直接使用，文件/图片类型传空字符串（依赖匹配指令）
    const searchText = content.type === 'text' ? content.text || '' : ''
    this.mainWindow.webContents.send('super-panel-search', {
      text: searchText,
      clipboardContent: content
    })
  }

  /**
   * 加载固定列表
   */
  private async loadPinnedCommands(): Promise<void> {
    try {
      // 从数据库读取超级面板固定列表
      let pinnedCommands = await databaseAPI.dbGet('super-panel-pinned')

      if (!pinnedCommands || !Array.isArray(pinnedCommands)) {
        pinnedCommands = []
      }

      // 发送固定列表到超级面板窗口
      this.sendToSuperPanel('super-panel-data', {
        type: 'pinned',
        commands: pinnedCommands
      })
    } catch (error) {
      console.error('[SuperPanel] 加载超级面板固定列表失败:', error)
      this.sendToSuperPanel('super-panel-data', {
        type: 'pinned',
        commands: []
      })
    }
  }

  /**
   * 发送数据到超级面板窗口（窗口未就绪时缓存消息）
   */
  private sendToSuperPanel(channel: string, data: any): void {
    if (this.superPanelWindow && !this.superPanelWindow.isDestroyed() && this.windowReady) {
      this.superPanelWindow.webContents.send(channel, data)
    } else {
      this.pendingMessages.push({ channel, data })
    }
  }

  /**
   * 设置 IPC 监听
   */
  private setupIPC(): void {
    // 主窗口返回搜索结果（携带剪贴板内容）
    ipcMain.on(
      'super-panel-search-result',
      (_event, data: { results: any[]; clipboardContent?: ClipboardContent }) => {
        this.sendToSuperPanel('super-panel-data', {
          type: 'search',
          results: data.results,
          clipboardContent: data.clipboardContent
        })
      }
    )

    // 超级面板启动指令 → 转发给主渲染进程处理
    ipcMain.handle('super-panel:launch', async (_event, command: any) => {
      try {
        // 隐藏超级面板
        this.hideWindow()

        if (!this.mainWindow || this.mainWindow.isDestroyed()) {
          return { success: false, error: '主窗口不可用' }
        }

        // 先显示主窗口，确保渲染进程能正常处理启动指令
        this.mainWindow.show()

        // 转发给主渲染进程，由 handleSelectApp 统一处理
        // 携带剪贴板内容作为 payload 来源
        this.mainWindow.webContents.send('super-panel-launch', {
          command,
          clipboardContent: this.currentClipboardContent
        })

        return { success: true }
      } catch (error) {
        console.error('[SuperPanel] 超级面板启动指令失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    // 超级面板窗口准备好接收数据
    ipcMain.on('super-panel:ready', () => {
      this.windowReady = true
      // 发送所有缓存的消息
      for (const msg of this.pendingMessages) {
        if (this.superPanelWindow && !this.superPanelWindow.isDestroyed()) {
          this.superPanelWindow.webContents.send(msg.channel, msg.data)
        }
      }
      this.pendingMessages = []
    })

    // 超级面板请求加载固定列表（从搜索模式切换回固定模式）
    ipcMain.on('super-panel:show-pinned', () => {
      this.loadPinnedCommands()
    })

    // 超级面板头像点击：隐藏超级面板，显示主搜索窗口
    ipcMain.on('super-panel:show-main-window', () => {
      this.hideWindow()
      windowManager.showWindow()
    })

    // 更新超级面板固定列表顺序
    ipcMain.handle('super-panel:update-pinned-order', async (_event, commands: any[]) => {
      try {
        await databaseAPI.dbPut('super-panel-pinned', commands)
        return { success: true }
      } catch (error) {
        console.error('[SuperPanel] 更新超级面板固定列表顺序失败:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : '未知错误'
        }
      }
    })

    // 取消固定命令
    ipcMain.handle(
      'super-panel:unpin-command',
      async (_event, path: string, featureCode?: string) => {
        try {
          console.log('[SuperPanel] 收到取消固定请求:', { path, featureCode })
          let pinnedCommands = await databaseAPI.dbGet('super-panel-pinned')
          if (!Array.isArray(pinnedCommands)) {
            pinnedCommands = []
          }

          // 过滤掉要取消固定的命令
          pinnedCommands = pinnedCommands.filter((cmd: any) => {
            if (featureCode) {
              return !(cmd.path === path && cmd.featureCode === featureCode)
            }
            return cmd.path !== path
          })

          console.log('[SuperPanel] 更新后的固定列表:', pinnedCommands.length, '项')
          await databaseAPI.dbPut('super-panel-pinned', pinnedCommands)

          // 重新加载固定列表
          this.loadPinnedCommands()
          console.log('[SuperPanel] 已重新加载固定列表')

          return { success: true }
        } catch (error) {
          console.error('[SuperPanel] 取消固定失败:', error)
          return {
            success: false,
            error: error instanceof Error ? error.message : '未知错误'
          }
        }
      }
    )
  }
}

export default new SuperPanelManager()
