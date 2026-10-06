<template>
  <DataTable :columns="columns" :rows="members" row-key="id" selectable :selected="selected"
    empty-text="メンバーはいません" @update:selected="$emit('update:selected', $event)">
    <template #cell-photo="{ row }">
      <img v-if="row.photoAssetId || row.photoAsset" :src="getMemberImageSrc(row)" alt="photo" class="preview-img" />
      <span v-else>-</span>
    </template>
    <template #cell-actions="{ row }">
      <div class="row-actions">
        <UiButton size="sm" icon="edit" icon-only aria-label="詳細" title="詳細" @click="$emit('edit', row)" />
        <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="このゲームから外す"
          title="このゲームから外す" @click="$emit('delete', row.id)" />
      </div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { DataTable, UiButton } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
const columns: DataTableColumn[] = [
  { key: 'photo', label: '写真' },
  { key: 'name', label: '名前', sortable: true },
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
