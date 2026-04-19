# Windows 文件管理器支持开发文档

## 需求背景

当前【复制路径】和【在终端打开】两个系统指令仅支持 macOS 的 Finder，需要在 Windows 系统的文件管理器（explorer.exe）中也支持这两个功能。

## 技术方案

### 核心原理

利用已有的原生模块 API `getExplorerFolderPath(hwnd)` 获取 Windows Explorer 当前窗口的文件夹路径。该 API 通过 COM IShellWindows 接口查询指定窗口句柄对应的 Explorer 文件夹路径。

### 修改范围

#### 1. 指令配置 (`internal-plugins/system/public/plugin.json`)

- 修改 `copy-path` 和 `open-terminal` 两个 feature 的 window match 配置
- 在 `match.app` 数组中添加 `"explorer.exe"`

#### 2. 系统命令实现 (`src/main/api/renderer/systemCommands.ts`)

- 修改 `handleCopyPath` 函数，添加 Windows 平台支持
- 修改 `handleOpenTerminal` 函数，添加 Windows 平台支持
- 通过 `WindowManager.getExplorerFolderPath(hwnd)` 获取 Explorer 路径

## 详细设计

### 1. plugin.json 修改

```json
{
  "code": "copy-path",
  "cmds": [
    {
      "type": "window",
      "match": { "app": ["Finder.app", "explorer.exe"] }
    }
  ]
}
```

```json
{
  "code": "open-terminal",
  "cmds": [
    {
      "type": "window",
      "match": { "app": ["Finder.app", "explorer.exe"] }
    }
  ]
}
```

### 2. handleCopyPath Windows 实现

```typescript
async function handleCopyPathWin(ctx: SystemCommandContext): Promise<any> {
  const previousWindow = windowManager.getPreviousActiveWindow()
  if (!previousWindow?.hwnd) {
    return { success: false, error: '无法获取当前窗口信息' }
  }

  const { WindowManager } = await import('../../core/native/index.js')
  const folderPath = WindowManager.getExplorerFolderPath(previousWindow.hwnd)

  if (!folderPath) {
    return { success: false, error: '无法获取资源管理器路径' }
  }

  // 将 file:/// 路径转换为普通路径
  const normalPath = folderPath.replace(/^file:\/\/\//i, '').replace(/\//g, '\\')
  clipboard.writeText(normalPath)
  ctx.mainWindow?.hide()
  return { success: true, path: normalPath }
}
```

### 3. handleOpenTerminal Windows 实现

```typescript
async function handleOpenTerminalWin(ctx: SystemCommandContext): Promise<any> {
  const previousWindow = windowManager.getPreviousActiveWindow()
  if (!previousWindow?.hwnd) {
    return { success: false, error: '无法获取当前窗口信息' }
  }

  const { WindowManager } = await import('../../core/native/index.js')
  const folderPath = WindowManager.getExplorerFolderPath(previousWindow.hwnd)

  if (!folderPath) {
    return { success: false, error: '无法获取资源管理器路径' }
  }

  const normalPath = folderPath.replace(/^file:\/\/\//i, '').replace(/\//g, '\\')

  // 尝试打开 Windows Terminal，回退到 PowerShell，再回退到 CMD
  const tryLaunchTerminal = async (): Promise<boolean> => {
    const { spawn } = await import('child_process')
    return new Promise((resolve) => {
      const child = spawn('wt.exe', ['-d', normalPath], {
        detached: true,
        stdio: 'ignore',
        shell: true
      })
      child.on('error', () => resolve(false))
      if (child.pid) {
        child.unref()
        resolve(true)
      }
    })
  }

  const tryLaunchPowerShell = async (): Promise<boolean> => {
    const { spawn } = await import('child_process')
    return new Promise((resolve) => {
      const child = spawn(
        'powershell.exe',
        ['-NoExit', '-Command', `Set-Location -Path "${normalPath}"`],
        {
          detached: true,
          stdio: 'ignore'
        }
      )
      child.on('error', () => resolve(false))
      if (child.pid) {
        child.unref()
        resolve(true)
      }
    })
  }

  const tryLaunchCMD = async (): Promise<boolean> => {
    const { spawn } = await import('child_process')
    return new Promise((resolve) => {
      const child = spawn('cmd.exe', ['/K', `cd /d "${normalPath}"`], {
        detached: true,
        stdio: 'ignore'
      })
      child.on('error', () => resolve(false))
      if (child.pid) {
        child.unref()
        resolve(true)
      }
    })
  }

  const launched =
    (await tryLaunchTerminal()) || (await tryLaunchPowerShell()) || (await tryLaunchCMD())

  if (!launched) {
    return { success: false, error: '无法启动终端' }
  }

  ctx.mainWindow?.hide()
  return { success: true }
}
```

### 4. 路由修改

在 `executeSystemCommand` 函数的 switch 语句中，根据平台调用不同实现：

```typescript
case 'copy-path':
  if (process.platform === 'win32') {
    return handleCopyPathWin(ctx)
  }
  return handleCopyPath(ctx, execAsync)

case 'open-terminal':
  if (process.platform === 'win32') {
    return handleOpenTerminalWin(ctx)
  }
  return handleOpenTerminal(ctx, execAsync)
```

## 测试计划

### 单元测试

1. 测试 `handleCopyPathWin` 正常获取路径并复制到剪贴板
2. 测试 `handleOpenTerminalWin` 正常打开终端并切换到对应目录
3. 测试无 hwnd 时的错误处理
4. 测试无法获取路径时的错误处理
5. 测试终端启动失败时的回退逻辑

### 集成测试

1. 在 Windows 文件管理器中唤起超级面板，验证【复制路径】指令显示
2. 点击【复制路径】，验证路径正确复制到剪贴板
3. 在 Windows 文件管理器中唤起超级面板，验证【在终端打开】指令显示
4. 点击【在终端打开】，验证终端正确打开并切换到对应目录
5. 验证在非 explorer 窗口唤起时不会显示这两个指令

### 回归测试

1. 验证 macOS 的【复制路径】和【在终端打开】功能正常工作
2. 验证 Linux 的【在终端打开】功能正常工作

## 风险与注意事项

1. **原生模块依赖**：`getExplorerFolderPath` 需要 Windows 原生模块支持，确保在 Windows 环境测试
2. **路径格式转换**：Windows 路径需要将 `file:///` URL 格式转换为普通路径格式
3. **终端兼容性**：优先使用 Windows Terminal (wt.exe)，但需要兼容旧系统（PowerShell/CMD）
4. **权限问题**：某些目录可能需要管理员权限才能访问
