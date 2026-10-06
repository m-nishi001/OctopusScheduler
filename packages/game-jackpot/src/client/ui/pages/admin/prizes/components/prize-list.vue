<template>
  <DataTable :columns="columns" :rows="prizes" row-key="id" selectable :selected="selected"
    empty-text="景品はありません" @update:selected="$emit('update:selected', $event)">
    <template #cell-preview="{ row: prize }">
      <div class="prize-preview four-image">
          <template
            v-if="prize.imageAssetId || prize.image2AssetId || prize.winningImage1AssetId || prize.winningImage2AssetId">
            <div class="preview-half">
              <img v-if="prize.imageAssetId" :src="objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId"
                alt="image1" class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">画像1なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.image2AssetId" :src="objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId"
                alt="image2" class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">画像2なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.winningImage1AssetId"
                :src="objectUrlMap.get(prize.winningImage1AssetId) || prize.winningImage1AssetId" alt="winning1"
                class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">当選1なし</div>
            </div>
            <div class="preview-half">
              <img v-if="prize.winningImage2AssetId"
                :src="objectUrlMap.get(prize.winningImage2AssetId) || prize.winningImage2AssetId" alt="winning2"
                class="preview-img" @error="onImageError" />
              <div v-else class="preview-placeholder small">当選2なし</div>
            </div>
          </template>
          <template v-else>
            <span>{{ prize.name }}</span>
          </template>
        </div>
    </template>
    <template #cell-actions="{ row }">
      <div class="row-actions">
        <UiButton size="sm" icon="edit" icon-only aria-label="詳細" title="詳細" @click="$emit('edit', row)" />
        <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除" @click="$emit('delete', row.id)" />
      </div>
    </template>
  </DataTable>
</template>

<script setup lang="ts">
import { DataTable, UiButton } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
const columns: DataTableColumn[] = [
  { key: 'preview', label: 'プレビュー' },
  { key: 'name', label: '景品名', sortable: true },
  { key: 'actions', label: '操作' },
];

defineProps({
  prizes: { type: Array as () => any[], required: true },
  selected: { type: Array as () => string[], required: true },
  objectUrlMap: { type: Object as () => Map<string, string>, required: true },
});

defineEmits<{
  edit: [prize: any];
  delete: [id: string];
  'update:selected': [ids: string[]];
}>();

const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNTU1Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjY2NjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  img.alt = 'No Image';
};
</script>

<style scoped>
.prize-preview {
  width: 110px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-bg, #23252b);
  border-radius: var(--ui-radius, 6px);
  overflow: hidden;
}

.prize-preview.four-image {
  padding: 0;
}

.four-image .preview-half {
  width: 25%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.four-image .preview-half .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview-placeholder.small {
  font-size: var(--ui-font-xs, 0.75rem);
  color: var(--ui-text-muted, #cfd6dd);
  padding: 6px;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.row-actions {
  display: flex;
  gap: var(--ui-space-2, 8px);
}
</style>
