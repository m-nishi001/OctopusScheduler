<template>
  <UiDialog :model-value="true" :title="deleting ? '削除中...' : 'メンバーをこのゲームから外す'" size="sm" nested :persistent="deleting"
    :confirm-label="deleting ? undefined : '外す'" danger @confirm="$emit('confirm')" @close="$emit('cancel')">
    <p v-if="!deleting" class="message">
      選択したメンバーをジャックポットから外しますか？共有マスタからは削除されないため、他のゲームの名簿には影響しません。
    </p>
    <p v-else class="message">{{ deleteMessage }}</p>
  </UiDialog>
</template>

<script setup lang="ts">
import { UiDialog } from '@octopus/ui-kit';

defineProps({
  deleting: { type: Boolean, default: false },
  deleteMessage: { type: String, default: '' },
});
defineEmits(['confirm', 'cancel']);
</script>

<style scoped>
.message {
  margin: 0;
}
</style>
