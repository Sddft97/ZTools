<template>
  <div class="hotkey-input" :class="{ recording: isRecording }" @click="startRecording">
    {{ displayHotkey }}
  </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'

interface Props {
  modelValue: string
  placeholder?: string
  platform?: 'darwin' | 'win32' | 'linux'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '点击录制快捷键',
  platform: 'darwin'
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
}>()

const MODIFIER_CODES = [
  'MetaLeft',
  'MetaRight',
  'ControlLeft',
  'ControlRight',
  'AltLeft',
  'AltRight',
  'ShiftLeft',
  'ShiftRight'
]

const DOUBLE_TAP_INTERVAL = 400
const MODIFIER_NAMES = ['Command', 'Ctrl', 'Alt', 'Option', 'Shift']

function isDoubleTapFormat(value: string): boolean {
  if (!value) return false
  const parts = value.split('+')
  return parts.length === 2 && parts[0] === parts[1] && MODIFIER_NAMES.includes(parts[0])
}

const isRecording = ref(false)
const recordedKeys = ref<string[]>([])

// 双击检测状态
const lastModifierOnlyTap = ref<{ modifier: string; time: number } | null>(null)
const doubleTapTimer = ref<ReturnType<typeof setTimeout> | null>(null)
const mainKeyPressed = ref(false)

function getModifierName(code: string): string {
  switch (code) {
    case 'MetaLeft':
    case 'MetaRight':
      return 'Command'
    case 'ControlLeft':
    case 'ControlRight':
      return 'Ctrl'
    case 'AltLeft':
    case 'AltRight':
      return props.platform === 'win32' ? 'Alt' : 'Option'
    case 'ShiftLeft':
    case 'ShiftRight':
      return 'Shift'
    default:
      return ''
  }
}

const displayHotkey = computed(() => {
  if (isRecording.value) {
    if (recordedKeys.value.length > 0) {
      return recordedKeys.value.join('+')
    }
    return '请按下快捷键...'
  }
  if (isDoubleTapFormat(props.modelValue)) {
    return props.modelValue
  }
  return props.modelValue || props.placeholder
})

async function startRecording(): Promise<void> {
  isRecording.value = true
  recordedKeys.value = []
  mainKeyPressed.value = false
  lastModifierOnlyTap.value = null
  clearDoubleTapTimer()

  try {
    const result = await window.ztools.internal.startHotkeyRecording()
    if (result.success) {
      console.log('已启动后端快捷键监听')
    } else {
      console.warn('启动后端快捷键监听失败，使用前端监听:', result.error)
    }
  } catch (error) {
    console.error('启动后端快捷键监听异常，使用前端监听:', error)
  }

  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('keyup', handleKeyUp)
}

function stopRecording(): void {
  isRecording.value = false
  mainKeyPressed.value = false
  lastModifierOnlyTap.value = null
  clearDoubleTapTimer()
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('keyup', handleKeyUp)
}

function clearDoubleTapTimer(): void {
  if (doubleTapTimer.value) {
    clearTimeout(doubleTapTimer.value)
    doubleTapTimer.value = null
  }
}

function confirmShortcut(shortcut: string): void {
  recordedKeys.value = shortcut.split('+')
  emit('update:modelValue', shortcut)
  emit('change', shortcut)
  stopRecording()
}

function handleKeyDown(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()

  const isModifierKey = MODIFIER_CODES.includes(e.code)

  const keys: string[] = []
  if (e.metaKey) keys.push('Command')
  if (e.ctrlKey) keys.push('Ctrl')
  if (e.altKey) keys.push(props.platform === 'win32' ? 'Alt' : 'Option')
  if (e.shiftKey) keys.push('Shift')

  if (!isModifierKey) {
    mainKeyPressed.value = true
    // 按下了非修饰键，取消双击等待
    clearDoubleTapTimer()
    lastModifierOnlyTap.value = null

    let mainKey = ''
    if (e.code.startsWith('Key')) {
      mainKey = e.code.replace('Key', '')
    } else if (e.code.startsWith('Digit')) {
      mainKey = e.code.replace('Digit', '')
    } else if (e.code.startsWith('Numpad')) {
      mainKey = e.code
    } else {
      mainKey = e.code
    }
    if (mainKey) keys.push(mainKey)
  }

  recordedKeys.value = keys
}

function handleKeyUp(e: KeyboardEvent): void {
  e.preventDefault()
  e.stopPropagation()

  const isModifierKey = MODIFIER_CODES.includes(e.code)

  if (isModifierKey && !mainKeyPressed.value) {
    // 仅修饰键被按下后松开，没有按其他键
    // 检查当前是否只有一个修饰键（排除组合修饰键如 Command+Shift）
    const modifier = getModifierName(e.code)
    if (!modifier) {
      stopRecording()
      return
    }

    const activeModifiers: string[] = []
    if (e.metaKey) activeModifiers.push('Command')
    if (e.ctrlKey) activeModifiers.push('Ctrl')
    if (e.altKey) activeModifiers.push(props.platform === 'win32' ? 'Alt' : 'Option')
    if (e.shiftKey) activeModifiers.push('Shift')

    // 只在所有修饰键都释放时才计为一次 tap
    if (activeModifiers.length > 0) {
      return
    }

    const now = Date.now()

    // 检查是否匹配第二次 tap
    if (
      lastModifierOnlyTap.value &&
      lastModifierOnlyTap.value.modifier === modifier &&
      now - lastModifierOnlyTap.value.time < DOUBLE_TAP_INTERVAL
    ) {
      clearDoubleTapTimer()
      confirmShortcut(`${modifier}+${modifier}`)
      return
    }

    // 第一次 tap，开始等待第二次
    lastModifierOnlyTap.value = { modifier, time: now }
    recordedKeys.value = ['请再按一次非修饰键...']

    clearDoubleTapTimer()
    doubleTapTimer.value = setTimeout(() => {
      // 等待超时，重置状态继续录制
      lastModifierOnlyTap.value = null
      doubleTapTimer.value = null
      if (isRecording.value) {
        recordedKeys.value = []
      }
    }, DOUBLE_TAP_INTERVAL)
    return
  }

  // 常规快捷键确认：至少一个修饰键 + 一个主键
  if (recordedKeys.value.length > 1 && mainKeyPressed.value) {
    confirmShortcut(recordedKeys.value.join('+'))
    return
  }

  stopRecording()
}

// 处理后端传来的快捷键（立即确认）
function handleHotkeyRecorded(shortcut: string): void {
  if (isRecording.value) {
    console.log('收到后端快捷键录制事件:', shortcut)
    confirmShortcut(shortcut)
  }
}

if (window.ztools.internal.onHotkeyRecorded) {
  window.ztools.internal.onHotkeyRecorded(handleHotkeyRecorded)
}

onUnmounted(() => {
  stopRecording()
})

defineExpose({
  stopRecording
})
</script>

<style scoped>
.hotkey-input {
  min-width: 150px;
  padding: 6px 16px;
  border: 2px solid var(--control-border);
  border-radius: 6px;
  background: var(--control-bg);
  color: var(--text-color);
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  user-select: none;
}

.hotkey-input:hover {
  background: var(--hover-bg);
  border-color: color-mix(in srgb, var(--primary-color), black 15%);
}

.hotkey-input.recording {
  border-color: color-mix(in srgb, var(--primary-color), black 15%);
  background: var(--primary-light-bg);
  color: var(--primary-color);
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}
</style>
