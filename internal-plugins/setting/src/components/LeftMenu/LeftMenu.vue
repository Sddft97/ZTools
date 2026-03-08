<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { MenuRouterItemType } from '@/router'
import { useRoute, useRouter } from 'vue-router'

const router = useRouter()
const route = useRoute()
// 设置激活菜单
const setActiveMenu = ({ name }: MenuRouterItemType): void => {
  router.replace({ name })
}

const menuRoutes = ref<MenuRouterItemType[]>([] as MenuRouterItemType[])

// 自动加载路由
const autoLoadRouter = (): void => {
  menuRoutes.value = router
    .getRoutes()
    .filter((item) => item.meta)
    .filter((item) => item.path.split('/').length <= 2)
    .filter((item) => item.meta.menu) as MenuRouterItemType[]
}

onMounted(() => {
  autoLoadRouter()
})
</script>

<template>
  <!-- 左侧菜单 -->
  <div class="settings-sidebar">
    <div
      v-for="menuRoute in menuRoutes"
      :key="menuRoute.name"
      class="menu-item"
      :class="{ active: route.name === menuRoute.name }"
      @click="setActiveMenu(menuRoute)"
    >
      <div :class="menuRoute.meta.menu.icon" class="menu-icon" style="font-size: 18px" />
      <span class="menu-label">{{ menuRoute.meta.menu.label }}</span>
    </div>
  </div>
</template>

<style scoped>
/* 左侧菜单 */
.settings-sidebar {
  width: 200px;
  border-right: 1px solid var(--divider-color);
  padding: 12px 8px;
  overflow-y: auto;
  height: 100%;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  gap: 10px;
  margin-bottom: 6px;
  cursor: pointer;
  transition: all 0.2s;
  color: var(--text-color);
  border-radius: 8px;
}

.menu-item:last-child {
  margin-bottom: 0;
}

.menu-item:hover {
  background: var(--hover-bg);
}

.menu-item.active {
  background: var(--active-bg);
  color: var(--primary-color);
  font-weight: 500;
}
</style>
