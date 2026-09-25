<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content preview-modal">
      <h3>アセットプレビュー</h3>
      <div class="preview-body">
        <div class="preview-media">
          <img v-if="resolvedAsset?.blob && resolvedAsset.blob.type && resolvedAsset.blob.type.startsWith('image') && previewUrl"
            :src="previewUrl" alt="preview image" class="preview-img" />

          <video
            v-else-if="resolvedAsset?.blob && resolvedAsset.blob.type && resolvedAsset.blob.type.startsWith('video') && previewUrl"
            :src="previewUrl" controls class="preview-video"></video>

          <audio
            v-else-if="resolvedAsset?.blob && resolvedAsset.blob.type && resolvedAsset.blob.type.startsWith('audio') && previewUrl"
            :src="previewUrl" controls class="preview-audio"></audio>

          <div v-else class="preview-empty">プレビューできません</div>
        </div>
        <div class="preview-info">
          <p><strong>ファイル名:</strong> {{ resolvedAsset?.name }}</p>
          <p><strong>サイズ:</strong> {{ resolvedAsset ? formatSize(resolvedAsset.size) : '-' }}</p>
          <p><strong>種別:</strong> {{ prettyAssetType(resolvedAsset?.blob?.type) }}</p>
          <div style="margin-top:12px; text-align:right;">
            <button class="admin-btn" @click.prevent="$emit('close')">閉じる</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';

const props = defineProps({
  asset: { type: Object as () => Asset, required: true },
  /** 一覧側が既に保持しているobject URL。管理外のURLだけをこのダイアログの責務で破棄する。 */
  objectUrlMap: { type: Object as () => Map<string, string>, required: true },
});

defineEmits(['close']);

const assetDataService = container.resolve(AssetDataService);

const resolvedAsset = ref<Asset | null>(props.asset);
const previewUrl = ref<string | null>(null);

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

function objectUrlIsManaged(url: string | null): boolean {
  if (!url) return false;
  for (const v of props.objectUrlMap.values()) {
    if (v === url) return true;
  }
  return false;
}

onMounted(async () => {
  const asset = props.asset;
  if (asset.id && props.objectUrlMap.has(asset.id)) {
    previewUrl.value = props.objectUrlMap.get(asset.id) || null;
  } else if (asset.blob) {
    try {
      previewUrl.value = URL.createObjectURL(asset.blob);
    } catch {
      previewUrl.value = null;
    }
  } else if (asset.id) {
    try {
      const a = await assetDataService.getAssetDataById(asset.id);
      if (a) {
        resolvedAsset.value = a;
        if (a.blob) previewUrl.value = URL.createObjectURL(a.blob);
      }
    } catch (e) {
      console.error('プレビュー取得エラー', e);
    }
  }
});

onBeforeUnmount(() => {
  if (previewUrl.value && !objectUrlIsManaged(previewUrl.value)) {
    try { URL.revokeObjectURL(previewUrl.value); } catch { /* ignore */ }
  }
});
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #232b36;
  color: #fff;
  padding: 28px;
  border-radius: 10px;
  text-align: left;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
  max-width: 720px;
  width: 90%;
}

.admin-btn {
  padding: 9px 18px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
}

.admin-btn:hover {
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
}

.preview-modal .preview-body {
  display: flex;
  gap: 18px;
  align-items: flex-start;
}

.preview-modal .preview-media {
  flex: 1 1 60%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #111315;
  border-radius: 8px;
  padding: 12px;
  min-height: 220px;
}

.preview-img,
.preview-video,
.preview-audio {
  max-width: 100%;
  max-height: 420px;
  display: block;
}

.preview-info {
  flex: 0 0 320px;
  padding: 8px 12px;
  background: #1f262b;
  border-radius: 8px;
}

.preview-empty {
  color: #c9d7e6;
}
</style>
