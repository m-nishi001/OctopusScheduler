<template>
  <div class="modal-overlay">
    <div class="modal-content" @click.stop>
      <div class="add-form-column">
        <h3>{{ mode === 'edit' ? 'メンバー詳細' : 'メンバーを追加' }}</h3>

        <div class="two-col">
          <div class="field-block">
            <label class="field-label">名前</label>
            <input v-model="name" type="text" placeholder="メンバー名" class="admin-input member-name-input" />
          </div>
          <div class="field-block">
            <label class="field-label">ランク</label>
            <input v-model.number="rank" type="number" placeholder="ランク" min="1" :max="maxRank" step="1"
              class="admin-input" />
          </div>
        </div>

        <div class="field-block">
          <label class="field-label">写真</label>
          <div class="photo-mode">
            <label><input type="radio" v-model="photoMode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="photoMode" value="select" /> 既存から選択</label>
          </div>
          <div style="margin-top:10px">
            <input v-if="photoMode === 'upload'" type="file" @change="onPhotoChange" accept="image/*"
              class="admin-input" />
            <div v-if="photoMode === 'upload' && photoFilename" class="file-name">{{ photoFilename }}</div>
            <select v-if="photoMode === 'select'" v-model="photoAssetId" class="admin-input" style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

        <div class="preview-in-form" style="margin-top:16px">
          <div class="preview-box">
            <template v-if="photoPreview">
              <img :src="photoPreview" alt="preview" class="preview-img" />
            </template>
            <template v-else>
              <div class="preview-placeholder">プレビュー</div>
            </template>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <div class="footer-right admin-modal-buttons">
          <button class="admin-btn" @click="submit" :disabled="!name.trim() || rank < 1 || saving">保存</button>
          <button class="admin-btn cancel-primary" @click="$emit('cancel')">キャンセル</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';
import type { MemberFormInput } from '../use-members';

const props = defineProps({
  mode: { type: String as () => 'add' | 'edit', required: true },
  member: { type: Object, default: null },
  imageAssets: { type: Array as () => Asset[], required: true },
});

const emit = defineEmits<{
  submit: [input: MemberFormInput];
  cancel: [];
}>();

const assetDataService = container.resolve(AssetDataService);

const name = ref('');
const rank = ref(1);
const maxRank = ref(10);
const photoMode = ref<'upload' | 'select'>('upload');
const photoAsset = ref<Asset | undefined>();
const photoPreview = ref('');
const photoFilename = ref('');
const photoAssetId = ref('');
const tempAsset = ref<Asset | null>(null);
const saving = ref(false);
let photoPreviewUrl: string | undefined;

const revokePreviewUrl = () => {
  if (photoPreviewUrl) {
    try { URL.revokeObjectURL(photoPreviewUrl); } catch { /* ignore */ }
    photoPreviewUrl = undefined;
  }
};

const loadFromMember = (member: any) => {
  name.value = member.name;
  rank.value = member.rank;
  maxRank.value = 10;
  if (member.photoAssetId) {
    photoMode.value = 'select';
    photoAssetId.value = member.photoAssetId;
  } else {
    photoMode.value = 'upload';
    photoAsset.value = member.photoAsset;
    if (photoAsset.value) {
      revokePreviewUrl();
      photoPreviewUrl = URL.createObjectURL(photoAsset.value.blob);
      photoPreview.value = photoPreviewUrl;
    }
  }
};

if (props.mode === 'edit' && props.member) {
  loadFromMember(props.member);
} else {
  rank.value = 5;
}

const updatePhotoPreview = async () => {
  revokePreviewUrl();
  if (photoAsset.value) {
    photoPreviewUrl = URL.createObjectURL(photoAsset.value.blob);
    photoPreview.value = photoPreviewUrl;
  } else if (photoAssetId.value) {
    const asset = await assetDataService.getAssetDataById(photoAssetId.value);
    if (asset) {
      photoPreviewUrl = URL.createObjectURL(asset.blob);
      photoPreview.value = photoPreviewUrl;
    } else {
      photoPreview.value = '';
    }
  } else {
    photoPreview.value = '';
  }
};

watch(photoAssetId, () => { updatePhotoPreview(); });
if (photoAssetId.value) updatePhotoPreview();

watch(photoMode, () => {
  if (photoMode.value === 'select') {
    tempAsset.value = null;
  }
});

const onPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const dto = await assetDataService.createDriveDataDtoFromFile(file);
  tempAsset.value = dto;
  photoAsset.value = dto;
  photoFilename.value = file.name;
  revokePreviewUrl();
  photoPreviewUrl = URL.createObjectURL(file);
  photoPreview.value = photoPreviewUrl;
};

const submit = async () => {
  if (!name.value.trim() || rank.value < 1 || saving.value) return;
  saving.value = true;
  try {
    emit('submit', {
      name: name.value,
      rank: rank.value,
      photoAssetId: photoMode.value === 'select' ? photoAssetId.value || undefined : undefined,
      tempAsset: photoMode.value === 'upload' ? tempAsset.value : null,
    });
  } finally {
    saving.value = false;
  }
};

onBeforeUnmount(() => {
  revokePreviewUrl();
});
</script>

<style scoped>
.two-col {
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 12px;
  align-items: end;
}

@media (max-width: 640px) {
  .two-col {
    grid-template-columns: 1fr;
  }
}

.admin-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.98rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
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
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.admin-btn:hover {
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
}

.admin-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.photo-mode {
  display: flex;
  gap: 16px;
}

.photo-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.member-name-input {
  flex: 1;
  min-width: 200px;
}

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
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.modal-overlay::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.modal-content {
  background: #232b36;
  color: #fff;
  padding: 28px;
  border-radius: 10px;
  text-align: left;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
  max-width: 620px;
  width: 90%;
}

.add-form-column {
  overflow: auto;
  min-height: 0;
  scrollbar-gutter: stable both-edges;
  --scrollbar-reserve: 16px;
  padding-right: var(--scrollbar-reserve);
  box-sizing: border-box;
  scrollbar-width: thin;
  -ms-overflow-style: auto;
}

.add-form-column::-webkit-scrollbar {
  width: 10px;
}

.add-form-column::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.06);
  border-radius: 6px;
}

.add-form-column .field-label {
  display: block;
  margin-bottom: 8px;
  color: #cfe8ff;
  font-weight: 600;
}

.field-block {
  margin-top: 12px;
}

.preview-box {
  width: 100%;
  max-width: 320px;
  height: 240px;
  background: #2a3137;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-box .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-placeholder {
  color: #9fb8db
}

.file-name {
  margin-top: 8px;
  color: #cfe8ff;
  font-size: 0.92rem;
}

.cancel-primary {
  background: #3b4650;
  color: #fff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.footer-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 18px;
}
</style>
