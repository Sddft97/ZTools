import { describe, it, expect } from 'vitest'
import { fileURLToPath } from 'url'

// 模拟 Windows 窗口信息接口
interface WindowsWindowInfo {
  hwnd?: number
  className?: string
}

/**
 * 获取 Windows 资源管理器当前文件夹路径
 * 从 systemCommands.ts 复制以便测试
 */
function getWindowsExplorerPath(
  windowInfo: WindowsWindowInfo,
  mockExplorerPath: string | null,
  mockDesktopPath: string = 'C:\\Users\\TestUser\\Desktop'
): string | null {
  // 桌面窗口特殊处理
  if (windowInfo.className === 'Progman' || windowInfo.className === 'WorkerW') {
    return mockDesktopPath
  }

  // 普通 Explorer 窗口
  if (!windowInfo.hwnd) {
    return null
  }

  const folderUrl = mockExplorerPath
  if (!folderUrl) {
    return null
  }

  // 使用 fileURLToPath 转换 URL
  try {
    return fileURLToPath(folderUrl)
  } catch {
    return folderUrl
  }
}

/**
 * 安全转义 PowerShell 路径参数
 */
function escapePowerShellPath(folderPath: string): string {
  const escaped = folderPath.replace(/'/g, "''")
  return `'${escaped}'`
}

/**
 * 安全转义 CMD 路径参数
 */
function escapeCmdPath(folderPath: string): string {
  const escaped = folderPath.replace(/"/g, '^"')
  return `"${escaped}"`
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
      // fileURLToPath 返回格式取决于平台，在 Linux 上是 /C:/Users/...
      expect(result).toMatch(/C:.*Users.*TestUser.*Documents/)
    })

    it('should handle URL encoded characters', () => {
      const mockPath = 'file:///C:/Users/TestUser/My%20Documents'
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, mockPath)
      expect(result).toContain('Users')
      expect(result).toContain('TestUser')
      expect(result).toContain('My Documents')
    })

    it('should handle paths with hash symbol', () => {
      const mockPath = 'file:///C:/Users/TestUser/Docs%23Work'
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, mockPath)
      expect(result).toContain('Users')
      expect(result).toContain('TestUser')
      expect(result).toContain('Docs#Work')
    })

    it('should return null when COM query returns null', () => {
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, null)
      expect(result).toBeNull()
    })

    it('should return raw value for non-file URLs', () => {
      const mockPath = 'C:\\Users\\TestUser\\Documents'
      const result = getWindowsExplorerPath({ hwnd: 123456, className: 'CabinetWClass' }, mockPath)
      expect(result).toBe('C:\\Users\\TestUser\\Documents')
    })
  })

  describe('escapePowerShellPath', () => {
    it('should escape single quotes by doubling them', () => {
      const result = escapePowerShellPath("C:\\Users\\Test\\Folder's Name")
      expect(result).toBe("'C:\\Users\\Test\\Folder''s Name'")
    })

    it('should handle normal paths without special chars', () => {
      const result = escapePowerShellPath('C:\\Users\\Test\\Documents')
      expect(result).toBe("'C:\\Users\\Test\\Documents'")
    })

    it('should handle paths with double quotes', () => {
      const result = escapePowerShellPath('C:\\Users\\Test\\"Quoted" Folder')
      expect(result).toBe('\'C:\\Users\\Test\\"Quoted" Folder\'')
    })
  })

  describe('escapeCmdPath', () => {
    it('should escape double quotes with caret', () => {
      const result = escapeCmdPath('C:\\Users\\Test\\"Quoted" Folder')
      expect(result).toBe('"C:\\Users\\Test\\^"Quoted^" Folder"')
    })

    it('should handle normal paths without special chars', () => {
      const result = escapeCmdPath('C:\\Users\\Test\\Documents')
      expect(result).toBe('"C:\\Users\\Test\\Documents"')
    })

    it('should handle paths with single quotes', () => {
      const result = escapeCmdPath("C:\\Users\\Test\\Folder's Name")
      expect(result).toBe('"C:\\Users\\Test\\Folder\'s Name"')
    })
  })
})
