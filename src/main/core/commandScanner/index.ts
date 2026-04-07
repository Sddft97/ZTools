import { Command } from './types'
import { scanApplications as macScan } from './macScanner'
import { scanApplications as winScan } from './windowsScanner'
import { scanApplications as linuxScan } from './linuxScanner'

export type { AppScanner, Command } from './types'

// 平台检测并导出对应的扫描函数
export async function scanApplications(): Promise<Command[]> {
  const platform = process.platform

  if (platform === 'darwin') {
    // macOS
    return macScan()
  } else if (platform === 'win32') {
    // Windows
    return winScan()
  } else if (platform === 'linux') {
    // Linux
    return linuxScan()
  } else {
    console.warn(`[Scanner] 不支持的平台: ${platform}`)
    return []
  }
}
