<template>
  <UiDialog :model-value="show" title="アクションを選択" size="sm" nested @close="onCancel">
    <p class="form-area">追加するアクションの種類を選択してください:</p>
    <ul class="action-type-list">
      <li v-for="(entry, key) in registry" :key="key">
        <UiButton class="action-type-btn" @click="selectType(key)">{{ entry.label }}</UiButton>
      </li>
    </ul>
    <template #footer>
      <UiButton @click="onCancel">閉じる</UiButton>
    </template>
  </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { uiActionEntries } from '../app-events/registry';
import type { UIActionEntry } from '../app-events/ui-action-entry';

defineProps<{ show: boolean }>();

const emit = defineEmits<{
  (e: 'select-type', payload: { type: string }): void;
  (e: 'cancel'): void;
}>();

const registry: Record<string, UIActionEntry> = Object.fromEntries(
  uiActionEntries.map((e) => [e.actionType, e])
);

function selectType(type: string) {
  emit('select-type', { type });
}

function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.form-area {
  margin: 0 0 var(--ui-space-3, 12px);
}

.action-type-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: var(--ui-space-2, 8px);
}

.action-type-btn {
  width: 100%;
}
</style>
