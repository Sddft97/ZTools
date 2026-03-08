import { useHistoryState } from '@/composables/useHistoryState'
import { onMounted } from 'vue'
import { onBeforeRouteUpdate } from 'vue-router'

/**
 * 处理路由跳转功能的 hooks
 * @param handler 处理函数
 */
export function useJumpFunction<T = any>(handler: (data: Partial<T>) => void): void {
  // 处理对应 ztools code 进来的功能
  const handleJumpZtoolsCode = (): void => {
    const state = useHistoryState<T>()
    handler(state)
  }
  onMounted(() => {
    handleJumpZtoolsCode()
  })
  onBeforeRouteUpdate(() => {
    handleJumpZtoolsCode()
  })
}
