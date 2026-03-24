import { clipboard, Notification, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { ScreenCapture } from './native'
import windowManager from '../managers/windowManager'

// 截图方法windows
export const screenWindow = (
  cb: (image: string, bounds?: { x: number; y: number; width: number; height: number }) => void
): void => {
  ScreenCapture.start((result) => {
    if (result.success) {
      const image = clipboard.readImage()
      const bounds = {
        x: result.x!,
        y: result.y!,
        width: result.width!,
        height: result.height!
      }
      cb && cb(image.isEmpty() ? '' : image.toDataURL(), bounds)
    } else {
      cb && cb('')
    }
  })
}

// 截图方法mac
export const handleScreenShots = (
  cb: (image: string, bounds?: { x: number; y: number; width: number; height: number }) => void
): void => {
  const tmpPath = path.join(os.tmpdir(), `screenshot_${Date.now()}.png`)
  exec(`screencapture -i -r "${tmpPath}"`, () => {
    if (fs.existsSync(tmpPath)) {
      try {
        const imageBuffer = fs.readFileSync(tmpPath)
        const base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`
        cb(base64Image)
        fs.unlinkSync(tmpPath)
      } catch {
        cb('')
      }
    } else {
      cb('')
    }
  })
}

export const screenCapture = (
  mainWindow?: BrowserWindow
): Promise<{ image: string; bounds?: { x: number; y: number; width: number; height: number } }> => {
  return new Promise((resolve) => {
    // 隐藏主窗口
    const wasVisible = mainWindow?.isVisible() || false
    if (mainWindow && wasVisible) {
      mainWindow.hide()
    }

    // 恢复窗口显示
    const restoreWindow = (): void => {
      if (mainWindow && wasVisible) {
        windowManager.showWindow()
      }
    }

    // 接收到截图后的执行程序
    if (process.platform === 'darwin') {
      handleScreenShots((image, bounds) => {
        restoreWindow()
        resolve({ image, bounds })
      })
    } else if (process.platform === 'win32') {
      screenWindow((image, bounds) => {
        restoreWindow()
        resolve({ image, bounds })
      })
    } else {
      new Notification({
        title: '兼容性支持度不够',
        body: 'Linux 系统截图暂不支持，我们将会尽快更新！'
      }).show()
      restoreWindow()
      resolve({ image: '', bounds: undefined })
    }
  })
}
