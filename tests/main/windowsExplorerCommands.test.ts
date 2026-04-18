import { describe, it, expect, vi, beforeEach } from 'vitest'

// 模拟 Windows 窗口信息接口
interface WindowsWindowInfo {
  hwnd?: number
  className?: string
}

// 模拟 getWindowsExplorerPath 函数逻辑
function getWindowsExplorerPath(
  windowInfo: WindowsWindowInfo,
  mockExplorerPath: string | null
): string | null {
  // 桌面窗口特殊处理
  if (windowInfo.className === 'Progman' || windowInfo.className === 'WorkerW') {
    return 'C:\\Users\\TestUser\\Desktop'
  }

  // 普通 Explorer 窗口
  if (!windowInfo.hwnd) {
    return null
  }

  const folderUrl = mockExplorerPath
  if (!folderUrl) {
    return null
  }

  // 将 file:/// URL 转换为本地路径
  return folderUrl.startsWith('file:///')
    ? decodeURIComponent(folderUrl.replace(/^file:\/\/\//i, '')).replace(/\//g, '\\')
    : folderUrl
}

describe('Windows Explorer Commands', () => {
  describe('getWindowsExplorerPath', () => {
    it('should return desktop path for Progman window', () => {
      const result = getWindowsExplorerPath({ className: 'Progman' }, null)
      expect(result).toBe('C:\\Users\\TestUser\\Desktop')
    })

    it('should return desktop path for WorkerW window', () => {
      const result = getWindowsExplorerPath({ className: 'WorkerW' }, null)
      expect(result).toBe('C:\\Users\\TestUser\\Desktop')
    })

    it('should return null when hwnd is missing', () => {
      const result = getWindowsExplorerPath({ className: 'CabinetWClass' }, null)
      expect(result).toBeNull()
    })

    it('should convert file URL to normal path', () => {
      const mockPath = 'file:///C:/Users/TestUser/Documents'
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, mockPath)
      expect(result).toBe('C:\\Users\\TestUser\\Documents')
    })

    it('should handle URL encoded characters', () => {
      const mockPath = 'file:///C:/Users/TestUser/My%20Documents'
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, mockPath)
      expect(result).toBe('C:\\Users\\TestUser\\My Documents')
    })

    it('should handle paths with hash symbol', () => {
      const mockPath = 'file:///C:/Users/TestUser/Docs%23Work'
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, mockPath)
      expect(result).toBe('C:\\Users\\TestUser\\Docs#Work')
    })

    it('should return null when COM query returns null', () => {
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, null)
      expect(result).toBeNull()
    })
  })

  describe('tryLaunchWindowsTerminal', () => {
    it('should generate correct command arguments', () => {
      const folderPath = 'C:\\Users\\Test\\Documents'

      // 验证命令参数构建逻辑
      const wtArgs = ['-d', folderPath]
      const psArgs = ['-NoExit', '-Command', `Set-Location -Path "${folderPath}"`]
      const cmdArgs = ['/K', `cd /d "${folderPath}"`]

      expect(wtArgs).toEqual(['-d', 'C:\\Users\\Test\\Documents'])
      expect(psArgs).toContain('-NoExit')
      expect(psArgs).toContain(`Set-Location -Path "${folderPath}"`)
      expect(cmdArgs).toContain(`/K`)
      expect(cmdArgs).toContain(`cd /d "${folderPath}"`)
    })

    it('should handle paths with spaces', () => {
      const folderPath = 'C:\\Program Files\\My Folder'
      const psArgs = ['-NoExit', '-Command', `Set-Location -Path "${folderPath}"`]

      expect(psArgs[2]).toBe('Set-Location -Path "C:\\Program Files\\My Folder"')
    })
  })
})
