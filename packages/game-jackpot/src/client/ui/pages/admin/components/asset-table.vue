<template>
  <DataTable :columns="columns" :rows="assets" row-key="id" selectable :selected="selected"
    empty-text="アセットはありません" @update:selected="$emit('update:selected', $event)">
    <template #cell-thumb="{ row: asset }">
      <div class="thumb-wrap" title="プレビュー" @click.stop="$emit('preview', asset)">
        <img v-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('image')) && objectUrlMap.get(asset.id)"
          :src="objectUrlMap.get(asset.id)" alt="thumb" class="thumb-img" />
        <video
          v-else-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('video')) && objectUrlMap.get(asset.id)"
          :src="objectUrlMap.get(asset.id)" class="thumb-video" muted playsinline></video>
        <div v-else-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('audio'))" class="thumb-audio">
          <UiIcon name="play" />
        </div>
        <div v-else class="thumb-empty">-</div>
      </div>
    </template>
    <template #cell-type="{ row }">{{ prettyAssetType(row.blob?.type) }}</template>
    <template #cell-size="{ row }">{{ formatSize(row.size) }}</template>
  </DataTable>
</template>

<script setup lang="ts">
import { DataTable, UiIcon } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import type { Asset } from '@model/asset/asset-data';

const columns: DataTableColumn[] = [
  { key: 'thumb', label: 'プレビュー' },
  { key: 'name', label: 'ファイル名', sortable: true },
  { key: 'type', label: 'アセット種別' },
  { key: 'size', label: 'サイズ' },
];

defineProps({
  assets: { type: Array as () => Asset[], required: true },
  selected: { type: Array as () => string[], required: true },
  objectUrlMap: { type: Object as () => Map<string, string>, required: true },
});

defineEmits<{
  preview: [asset: Asset];
  'update:selected': [ids: string[]];
}>();

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function prettyAssetType(mime: string | undefined): string {
  if (!mime) return 'file';
  if (mime.startsWith('image')) return '画像';
  if (mime.startsWith('video')) return '動画';
  if (mime.startsWith('audio')) return '音楽';
  return mime;
}
</script>

<style scoped>
.thumb-wrap {
  width: 96px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--ui-bg, #23252b);
  border-radius: var(--ui-radius, 6px);
  overflow: hidden;
  cursor: pointer;
}

.thumb-img,
.thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-audio,
.thumb-empty {
  color: var(--ui-text-muted, #cfd6dd);
}
</style>
