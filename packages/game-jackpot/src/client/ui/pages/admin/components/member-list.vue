<template>
  <DataTable :columns="columns" :rows="members" row-key="id" selectable :selected="selected"
    empty-text="メンバーはいません" @update:selected="$emit('update:selected', $event)">
    <template #cell-photo="{ row }">
      <img v-if="getMemberImageSrc(row)" :src="getMemberImageSrc(row)" alt="photo" class="preview-img" />
      <span v-else>-</span>
    </template>
    <template #cell-weight="{ row }">{{ resolveWeight(row.weight) }}</template>
    <template #cell-actions="{ row }">
      <div class="row-actions">
        <UiButton size="sm" icon="edit" icon-only aria-label="詳細" title="詳細" @click="$emit('edit', row)" />
        <UiButton size="sm" variant="danger" icon="restore" icon-only aria-label="設定を初期値に戻す"
          title="設定を初期値に戻す" @click="$emit('delete', row.id)" />
      </div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { DataTable, UiButton } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { resolveWeight } from '@model/draw/weighted-selector';
const columns: DataTableColumn[] = [
  { key: 'photo', label: '写真' },
  { key: 'name', label: '名前', sortable: true },
  { key: 'weight', label: '当選しやすさ' },
  { key: 'actions', label: '操作' },
];

defineProps({
  members: { type: Array as () => any[], required: true },
  selected: { type: Array as () => string[], required: true },
  getMemberImageSrc: { type: Function as unknown as () => (member: any) => string, required: true },
});

defineEmits<{
  edit: [member: any];
  delete: [id: string];
  'update:selected': [ids: string[]];
}>();
</script>

<style scoped>
.preview-img {
  display: block;
  width: 48px;
  height: 48px;
  object-fit: cover;
  border-radius: 50%;
}

.row-actions {
  display: flex;
  gap: var(--ui-space-2, 8px);
}
</style>
