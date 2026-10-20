<template>
  <UiDialog :model-value="true" :title="deleting ? '処理中...' : 'メンバーの設定を初期値に戻す'" size="sm" nested :persistent="deleting"
    :confirm-label="deleting ? undefined : '初期値に戻す'" danger @confirm="$emit('confirm')" @close="$emit('cancel')">
    <p v-if="!deleting" class="message">
      選択したメンバーのジャックポットの設定（ランク・当選しやすさ・写真）を初期値に戻しますか？名簿からは削除されません（メンバーの追加・削除は 設定 > アカウント で行います）。
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
