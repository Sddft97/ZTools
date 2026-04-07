import fs from 'fs/promises'
import fsSync from 'fs'
import path from 'path'
import os from 'os'
import { extractAcronym } from '../../utils/common'
import { Command } from './types'
import { pLimit } from './utils'

// ============================================================
// XDG .desktop 文件解析器
// ============================================================

interface DesktopEntry {
  Name?: string
  GenericName?: string
  Exec?: string
  Icon?: string
  NoDisplay?: string
  Hidden?: string
  Type?: string
  // 本地化字段
  [key: string]: string | undefined
}

/**
 * 解析 .desktop 文件，返回 [Desktop Entry] 部分的键值对
 */
function parseDesktopFile(content: string): DesktopEntry {
  const result: DesktopEntry = {}
  let inDesktopEntry = false

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()

    if (line === '[Desktop Entry]') {
      inDesktopEntry = true
      continue
    }

    // 遇到下一个 section 停止解析
    if (line.startsWith('[') && line.endsWith(']') && inDesktopEntry) {
      break
    }

    if (!inDesktopEntry || !line || line.startsWith('#')) continue

    const eqIdx = line.indexOf('=')
    if (eqIdx === -1) continue

    const key = line.slice(0, eqIdx).trim()
    const value = line.slice(eqIdx + 1).trim()
    result[key] = value
  }

  return result
}

/**
 * 获取本地化的应用名称
 * 优先级：Name[zh_CN] > Name[zh] > Name[en_US] > Name
 */
function getLocalizedName(entry: DesktopEntry): string {
  // 获取系统语言代码（如 "zh_CN"、"en_US"）
  const lang = process.env.LANG || process.env.LANGUAGE || ''
  const langCode = lang.split('.')[0] // 去掉编码部分 (UTF-8)
  const langBase = langCode.split('_')[0] // 只取语言部分 (zh)

  // 按优先级尝试本地化名称
  const candidates = [
    `Name[${langCode}]`, // Name[zh_CN]
    `Name[${langBase}_${langCode.split('_')[1]}]`, // 同上，防御性写法
    `Name[${langBase}]`, // Name[zh]
    'Name' // 兜底
  ]

  for (const key of candidates) {
    const value = entry[key]
    if (value && value.trim()) {
      return value.trim()
    }
  }

  return entry['Name']?.trim() || ''
}

/**
 * 清理 Exec 字段中的 % 参数占位符（如 %f, %u, %F, %U ...）
 * 并提取实际可执行文件路径
 */
function cleanExecCommand(exec: string): string {
  return exec
    .replace(/%[a-zA-Z]/g, '') // 移除 %f %u %F %U 等占位符
    .replace(/\s+/g, ' ') // 合并多余空格
    .trim()
}

// ============================================================
// 图标解析
// ============================================================

// XDG 图标主题搜索路径（按优先级排列）
function getIconSearchPaths(): string[] {
  const home = os.homedir()
  return [
    path.join(home, '.local/share/icons'),
    '/usr/share/icons',
    '/usr/share/pixmaps',
    path.join(home, '.icons'),
    '/usr/local/share/icons',
    '/usr/local/share/pixmaps'
  ]
}

const ICON_EXTENSIONS = ['.png', '.svg', '.xpm']
const ICON_PREFERRED_SIZES = ['256x256', '128x128', '64x64', '48x48', '32x32', 'scalable']

/**
 * 在 XDG 图标主题中查找图标文件路径
 * 如果找不到则返回 null
 */
async function findIconPath(iconName: string): Promise<string | null> {
  // 如果是绝对路径且存在，直接返回
  if (iconName.startsWith('/') && fsSync.existsSync(iconName)) {
    return iconName
  }

  // 去除扩展名（.desktop 文件中有时会带扩展名）
  const baseName = iconName.replace(/\.(png|svg|xpm)$/, '')

  const searchPaths = getIconSearchPaths()

  for (const searchPath of searchPaths) {
    // 先检查各个主题目录下的常用尺寸
    try {
      const themes = await fs.readdir(searchPath)
      for (const theme of ['hicolor', ...themes]) {
        for (const size of ICON_PREFERRED_SIZES) {
          for (const category of ['apps', 'applications']) {
            for (const ext of ICON_EXTENSIONS) {
              const iconPath = path.join(searchPath, theme, size, category, baseName + ext)
              if (fsSync.existsSync(iconPath)) {
                return iconPath
              }
            }
          }
        }
      }
    } catch {
      // 目录不存在，跳过
    }

    // pixmaps 目录直接查找
    for (const ext of ICON_EXTENSIONS) {
      const iconPath = path.join(searchPath, baseName + ext)
      if (fsSync.existsSync(iconPath)) {
        return iconPath
      }
    }
  }

  return null
}

// ============================================================
// 拼音首字母支持
// ============================================================

// 常用汉字 → 拼音首字母映射（每个 key 唯一）
const PINYIN_MAP: Record<string, string> = {
  微: 'w',
  信: 'x',
  浏: 'l',
  览: 'l',
  器: 'q',
  网: 'w',
  易: 'y',
  邮: 'y',
  件: 'j',
  音: 'y',
  乐: 'l',
  视: 's',
  频: 'p',
  图: 't',
  片: 'p',
  文: 'w',
  档: 'd',
  办: 'b',
  公: 'g',
  计: 'j',
  算: 's',
  机: 'j',
  设: 's',
  置: 'z',
  系: 'x',
  统: 't',
  终: 'z',
  端: 'd',
  管: 'g',
  理: 'l',
  火: 'h',
  狐: 'h',
  谷: 'g',
  歌: 'g',
  百: 'b',
  度: 'd',
  钟: 'z',
  表: 'b',
  历: 'l',
  日: 'r',
  相: 'x',
  册: 'c',
  游: 'y',
  戏: 'x',
  下: 'x',
  载: 'z',
  安: 'a',
  装: 'z',
  卸: 'x',
  软: 'r',
  接: 'j',
  打: 'd',
  印: 'y',
  扫: 's',
  描: 'm',
  录: 'l',
  屏: 'p',
  远: 'y',
  程: 'c',
  桌: 'z',
  面: 'm',
  虚: 'x',
  拟: 'n',
  输: 's',
  法: 'f',
  字: 'z',
  典: 'd',
  电: 'd',
  话: 'h',
  通: 't',
  讯: 'x',
  聊: 'l',
  天: 't',
  地: 'd',
  画: 'h',
  编: 'b',
  辑: 'j',
  开: 'k',
  发: 'f',
  工: 'g',
  具: 'j',
  数: 's',
  据: 'j',
  库: 'k',
  服: 'f',
  务: 'w',
  调: 'd',
  试: 's',
  代: 'd',
  码: 'm',
  源: 'y',
  本: 'b',
  备: 'b',
  份: 'f',
  恢: 'h',
  复: 'f',
  优: 'y',
  化: 'h',
  清: 'q',
  洁: 'j',
  分: 'f',
  析: 'x',
  监: 'j',
  控: 'k',
  性: 'x',
  能: 'n',
  加: 'j',
  速: 's',
  压: 'y',
  缩: 's',
  解: 'j',
  密: 'm',
  转: 'z',
  换: 'h',
  格: 'g',
  式: 's',
  阅: 'y',
  读: 'd',
  播: 'b',
  放: 'f',
  全: 'q',
  防: 'f',
  护: 'h',
  墙: 'q',
  翻: 'f',
  译: 'y',
  助: 'z',
  手: 's',
  笔: 'b',
  记: 'j',
  板: 'b',
  制: 'z',
  作: 'z',
  创: 'c',
  意: 'y',
  原: 'y',
  型: 'x',
  演: 'y',
  示: 's',
  幻: 'h',
  灯: 'd',
  看: 'k',
  语: 'y',
  账: 'z',
  单: 'd',
  存: 'c',
  夹: 'j',
  连: 'l',
  络: 'l',
  蓝: 'l',
  牙: 'y',
  无: 'w',
  线: 'x',
  耳: 'e',
  摄: 's',
  像: 'x',
  头: 't',
  筒: 't',
  量: 'l',
  均: 'j',
  衡: 'h',
  混: 'h',
  新: 'x',
  闻: 'w',
  订: 'd',
  收: 's',
  藏: 'c',
  辞: 'c',
  词: 'c',
  白: 'b',
  列: 'l',
  注: 'z'
}

/**
 * 提取中文字符串的拼音首字母
 * 例如：「微信」→「wx」，「谷歌浏览器」→「gglq」
 */
function extractPinyinAcronym(name: string): string {
  let result = ''
  for (const char of name) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      result += PINYIN_MAP[char] || ''
    } else if (/[a-zA-Z]/.test(char)) {
      result += char.toLowerCase()
    }
  }
  return result
}

/**
 * 判断字符串是否包含中文字符
 */
function hasChinese(str: string): boolean {
  return /[\u4e00-\u9fa5]/.test(str)
}

// ============================================================
// 应用扫描入口
// ============================================================

/**
 * 获取 Linux 上所有 .desktop 文件的搜索路径（XDG 规范）
 */
function getLinuxDesktopPaths(): string[] {
  const home = os.homedir()
  const xdgDataDirs = process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share'
  const baseDirs = xdgDataDirs.split(':').filter(Boolean)

  const paths = [
    path.join(home, '.local/share/applications'), // 用户级
    ...baseDirs.map((dir) => path.join(dir, 'applications')) // 系统级
  ]

  return [...new Set(paths)] // 去重
}

/**
 * 扫描单个目录下的所有 .desktop 文件
 */
async function scanDesktopDir(dirPath: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries
      .filter((e) => e.isFile() && e.name.endsWith('.desktop'))
      .map((e) => path.join(dirPath, e.name))
  } catch {
    return []
  }
}

/**
 * 将单个 .desktop 文件转换为 Command 对象
 * 如果应用不应显示（NoDisplay=true 等），返回 null
 */
async function parseDesktopFileToCommand(desktopPath: string): Promise<Command | null> {
  try {
    const content = await fs.readFile(desktopPath, 'utf-8')
    const entry = parseDesktopFile(content)

    // 过滤不应显示的条目
    if (
      entry.Type !== 'Application' ||
      entry.NoDisplay === 'true' ||
      entry.Hidden === 'true' ||
      !entry.Exec
    ) {
      return null
    }

    const name = getLocalizedName(entry)
    if (!name) return null

    const exec = cleanExecCommand(entry.Exec)
    if (!exec) return null

    // 查找图标
    let iconUrl: string | undefined
    if (entry.Icon) {
      const iconPath = await findIconPath(entry.Icon)
      if (iconPath) {
        iconUrl = `file://${iconPath}`
      }
    }

    // 生成搜索别名（英文名 + 拼音首字母）
    const aliases: string[] = []

    // 如果有英文原名（Name 字段与本地化名称不同），添加为搜索别名
    const rawEnglishName = entry['Name']?.trim()
    if (rawEnglishName && rawEnglishName !== name) {
      aliases.push(rawEnglishName)
    }

    // 生成缩写：英文首字母缩写
    const acronym = extractAcronym(name) || (rawEnglishName ? extractAcronym(rawEnglishName) : '')

    // 如果名称包含中文，生成拼音首字母并加入 aliases
    if (hasChinese(name)) {
      const pinyinAcronym = extractPinyinAcronym(name)
      if (pinyinAcronym && pinyinAcronym !== acronym) {
        aliases.push(pinyinAcronym)
      }
    }

    return {
      name,
      path: exec,
      icon: iconUrl,
      aliases: aliases.length > 0 ? aliases : undefined,
      acronym: acronym || undefined
    }
  } catch {
    return null
  }
}

/**
 * 扫描 Linux 系统上安装的所有应用程序
 */
export async function scanApplications(): Promise<Command[]> {
  try {
    console.time('[LinuxScanner] 扫描应用')

    const searchPaths = getLinuxDesktopPaths()
    const allDesktopFiles: string[] = []

    // 收集所有 .desktop 文件路径
    for (const dirPath of searchPaths) {
      const files = await scanDesktopDir(dirPath)
      allDesktopFiles.push(...files)
    }

    // 去重（同一个 .desktop 文件可能出现在多个目录）
    const uniqueFiles = [...new Set(allDesktopFiles)]

    console.log(`[LinuxScanner] 找到 ${uniqueFiles.length} 个 .desktop 文件`)

    // 并发解析（限制并发数）
    const tasks = uniqueFiles.map((filePath) => () => parseDesktopFileToCommand(filePath))
    const results = await pLimit(tasks, 30)

    // 过滤掉解析失败或不应显示的项
    const apps = results.filter((cmd): cmd is Command => cmd !== null)

    console.timeEnd('[LinuxScanner] 扫描应用')
    console.log(`[LinuxScanner] 成功加载 ${apps.length} 个应用`)

    return apps
  } catch (error) {
    console.error('[LinuxScanner] 扫描应用失败:', error)
    return []
  }
}
