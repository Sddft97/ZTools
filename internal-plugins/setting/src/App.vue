<script setup lang="ts">
import { SettingHone, Toast, useToast } from '@/components'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
const { toastState, confirmState, handleConfirm, handleCancel } = useToast()
</script>

<template>
  <div id="app">
    <SettingHone />
  </div>
  <!-- 全局Toast组件 -->
  <Toast
    v-model:visible="toastState.visible"
    :message="toastState.message"
    :type="toastState.type"
    :duration="toastState.duration"
  />
  <!-- 全局确认对话框 -->
  <ConfirmDialog
    v-model:visible="confirmState.visible"
    :title="confirmState.title"
    :message="confirmState.message"
    :type="confirmState.type"
    :confirm-text="confirmState.confirmText"
    :cancel-text="confirmState.cancelText"
    @confirm="handleConfirm"
    @cancel="handleCancel"
  />
</template>

<style scoped></style>
