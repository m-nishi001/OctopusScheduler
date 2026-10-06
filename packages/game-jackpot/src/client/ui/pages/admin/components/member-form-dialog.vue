<template>
  <UiDialog :model-value="true" :title="mode === 'edit' ? 'メンバー詳細' : 'メンバーを追加'" size="lg" nested
    :close-on-overlay="false" confirm-label="保存" :loading="saving" :confirm-disabled="!canSubmit"
    @confirm="submit" @close="$emit('cancel')">

        <div v-if="mode === 'add'" class="form-group">
          <label>登録方法</label>
          <div class="photo-mode">
            <label><input type="radio" v-model="attachMode" value="new" /> 新規作成</label>
            <label>
              <input type="radio" v-model="attachMode" value="existing"
                :disabled="!existingDirectoryMembers.length" /> 共有マスタから選択
            </label>
          </div>
        </div>

        <div v-if="mode === 'add' && attachMode === 'existing'" class="form-group">
          <label>メンバー</label>
          <select v-model="selectedExistingId">
            <option value="">選択してください</option>
            <option v-for="m in existingDirectoryMembers" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>

        <div class="two-col">
          <div class="form-group">
            <label>名前</label>
            <input v-model="name" type="text" placeholder="メンバー名"
              :disabled="mode === 'add' && attachMode === 'existing'" />
          </div>
          <div class="form-group">
            <label>ランク</label>
            <input v-model.number="rank" type="number" placeholder="ランク" min="1" :max="maxRank" step="1"
              />
          </div>
        </div>

        <div class="form-group">
          <label>写真</label>
          <div class="photo-mode">
            <label><input type="radio" v-model="photoMode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="photoMode" value="select" /> 既存から選択</label>
          </div>
          <div style="margin-top:10px">
            <input v-if="photoMode === 'upload'" type="file" @change="onPhotoChange" accept="image/*"
              />
            <div v-if="photoMode === 'upload' && photoFilename" class="file-name">{{ photoFilename }}</div>
            <select v-if="photoMode === 'select'" v-model="photoAssetId" style="margin-top:8px">
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
  </UiDialog>
</template>

<script setup lang="ts">
import { UiDialog } from '@octopus/ui-kit';
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';
import type { Member as DirectoryMember } from '@octopus/member-directory';
import type { MemberFormInput } from '../use-members';

const props = defineProps({
  mode: { type: String as () => 'add' | 'edit', required: true },
  member: { type: Object, default: null },
  imageAssets: { type: Array as () => Asset[], required: true },
  existingDirectoryMembers: { type: Array as () => DirectoryMember[], default: () => [] },
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
const attachMode = ref<'new' | 'existing'>('new');
const selectedExistingId = ref('');
let photoPreviewUrl: string | undefined;

watch(attachMode, (value) => {
  if (value === 'new') {
    selectedExistingId.value = '';
    name.value = '';
  }
});

watch(selectedExistingId, (id) => {
  const found = props.existingDirectoryMembers.find((m) => m.id === id);
  name.value = found ? found.name : '';
});

const canSubmit = computed(() => {
  if (rank.value < 1 || saving.value) return false;
  if (props.mode === 'add' && attachMode.value === 'existing') {
    return !!selectedExistingId.value;
  }
  return !!name.value.trim();
});

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
  if (!canSubmit.value) return;
  saving.value = true;
  try {
    emit('submit', {
      id: props.mode === 'add' && attachMode.value === 'existing' ? selectedExistingId.value : undefined,
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

.photo-mode {
  display: flex;
  gap: 16px;
}

.photo-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ui-text, #fff);
}

.preview-box {
  width: 100%;
  max-width: 320px;
  height: 240px;
  background: var(--ui-surface, #2b3036);
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
  color: var(--ui-text-muted, #cfd6dd)
}

.file-name {
  margin-top: 8px;
  color: var(--ui-text-muted, #cfd6dd);
  font-size: var(--ui-font-sm, 0.875rem);
}
</style>
