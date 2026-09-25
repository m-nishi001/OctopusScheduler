<template>
  <div>
    <div v-if="assets.length" class="list-controls">
      <label class="select-all-label">
        <input type="checkbox" :checked="isAllSelected" @change="onToggleAll" class="select-all-checkbox" />
        <span class="sr-only">全選択</span>
      </label>
    </div>

    <div v-if="assets.length" class="table-wrap">
      <table class="asset-table">
        <thead>
          <tr>
            <th style="width:40px"><input type="checkbox" :checked="isAllSelected" @change="onToggleAll" /></th>
            <th style="width:110px">プレビュー</th>
            <th>ファイル名</th>
            <th>アセット種別</th>
            <th style="width:120px">サイズ</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="asset in assets" :key="asset.id">
            <td><input type="checkbox" :value="asset.id" :checked="selected.includes(asset.id)"
                @change="onToggleOne(asset.id)" /></td>
            <td class="thumb-cell">
              <div class="thumb-wrap" @click.stop="$emit('preview', asset)" title="プレビュー">
                <img v-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('image')) && objectUrlMap.get(asset.id)"
                  :src="objectUrlMap.get(asset.id)" alt="thumb" class="thumb-img" />

                <video
                  v-else-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('video')) && objectUrlMap.get(asset.id)"
                  :src="objectUrlMap.get(asset.id)" class="thumb-video" muted playsinline></video>

                <div v-else-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('audio'))"
                  class="thumb-audio">
                  <span>♪</span>
                </div>

                <div v-else class="thumb-empty">-</div>
              </div>
            </td>
            <td class="td-name">{{ asset.name }}</td>
            <td>{{ prettyAssetType(asset.blob?.type) }}</td>
            <td class="td-size">{{ formatSize(asset.size) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else class="empty-state">
      アセットはありません
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Asset } from '@model/asset/asset-data';

const props = defineProps({
  assets: { type: Array as () => Asset[], required: true },
  selected: { type: Array as () => string[], required: true },
  isAllSelected: { type: Boolean, required: true },
  objectUrlMap: { type: Object as () => Map<string, string>, required: true },
});

const emit = defineEmits<{
  preview: [asset: Asset];
  'update:selected': [ids: string[]];
  'update:isAllSelected': [value: boolean];
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

const onToggleAll = (e: Event) => {
  emit('update:isAllSelected', (e.target as HTMLInputElement).checked);
};

const onToggleOne = (id: string) => {
  const next = props.selected.includes(id)
    ? props.selected.filter((sid) => sid !== id)
    : [...props.selected, id];
  emit('update:selected', next);
};
</script>

<style scoped>
.list-controls {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.select-all-checkbox {
  width: 20px;
  height: 20px;
  margin: 0;
  vertical-align: middle;
}

.select-all-label {
  margin-left: 10px;
}

.empty-state {
  text-align: center;
  color: #c9d7e6;
  font-size: 1.1rem;
  padding: 40px;
}

.sr-only {
  position: absolute !important;
  height: 1px;
  width: 1px;
  overflow: hidden;
  clip: rect(1px, 1px, 1px, 1px);
  white-space: nowrap;
  border: 0;
  padding: 0;
  margin: -1px;
}

.table-wrap {
  max-height: 360px;
  overflow: auto;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.asset-table {
  width: 100%;
  border-collapse: collapse;
  color: #fff;
  min-width: 640px;
}

.asset-table thead th {
  background: #111315;
  padding: 12px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  text-align: left;
  font-weight: 700;
  color: #dbeeff;
}

.asset-table tbody td {
  padding: 10px 12px;
  border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
  vertical-align: middle;
}

.td-name {
  font-weight: 700;
  color: #fff;
}

.td-size {
  text-align: right;
  color: #c9d7e6;
}

.asset-table tbody tr:hover {
  background: rgba(255, 255, 255, 0.02);
}

.thumb-cell {
  padding: 6px 8px;
}

.thumb-wrap {
  width: 96px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #1f262b;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
}

.thumb-img {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.thumb-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.thumb-audio {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #cfe8ff;
  font-weight: 700;
}

.thumb-empty {
  color: #9fb7d6;
}
</style>
