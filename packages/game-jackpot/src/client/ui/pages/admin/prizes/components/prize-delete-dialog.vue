<template>
  <UiDialog :model-value="true" :title="deleting ? '削除中...' : '景品を削除'" size="sm" nested :persistent="deleting"
    :confirm-label="deleting ? undefined : '削除'" danger @confirm="$emit('confirm')" @close="$emit('cancel')">
    <p class="message">{{ deleting ? deleteMessage : '選択した景品を削除しますか？' }}</p>
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
