import { router } from '@/router'

export interface ShortcutsSettingJumpFunction {
  /**
   * 设置快捷键设置路径，传这个参数会直接打开快捷键设置页面
   */
  targetCommand?: string
}

/**
 * 快捷键跳转功能
 * @param config
 */
export function jumpFunctionShortcutsSetting(config: ShortcutsSettingJumpFunction): void {
  void router.replace({ name: 'Shortcuts', state: { ...config } })
}
