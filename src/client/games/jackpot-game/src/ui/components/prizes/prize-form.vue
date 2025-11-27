<template>
  <div class="prize-form">
    <div class="form-grid">
      <!-- Left Top: Image1 Preview -->
      <div class="image1-preview">
        <label class="field-label">景品当選画像</label>
        <div class="preview-box">
          <img v-if="image1Preview" :src="image1Preview" alt="景品画像1" />
          <div v-else class="placeholder">画像を選択してください</div>
        </div>
      </div>

      <!-- Right Top: Basic Fields -->
      <div class="basic-fields">
        <div class="name-field">
          <FieldText v-model="formData.name" label="名前" placeholder="景品名" />
        </div>
        <div class="rank-field">
          <FieldNumberStepper v-model="formData.rank" :min="1" label="景品ランク" />
        </div>
        <div class="animation-field">
          <FieldSelect v-model="formData.animation" :options="animationOptions" label="抽選アニメーション" />
        </div>
      </div>

      <!-- Left Bottom: Image2 -->
      <div class="image2-section">
        <ImageField label="画像2" v-model:mode="image2Mode" v-model:assetId="formData.image2AssetId"
          :filename="image2Filename" :preview="image2Preview" :assets="imageAssets" @file-change="onImage2Change" />
      </div>

      <!-- Winning Image1 -->
      <div class="winning-image1-section">
        <label class="field-label">当選景品画像1</label>
        <div class="preview-box">
          <img v-if="winningImage1Preview" :src="winningImage1Preview" alt="当選景品画像1" />
          <div v-else class="placeholder">画像を選択してください</div>
        </div>
        <input type="file" accept="image/*" @change="onWinningImage1Change" />
      </div>

      <!-- Winning Image2 -->
      <div class="winning-image2-section">
        <label class="field-label">当選景品画像2</label>
        <div class="preview-box">
          <img v-if="winningImage2Preview" :src="winningImage2Preview" alt="当選景品画像2" />
          <div v-else class="placeholder">画像を選択してください</div>
        </div>
        <input type="file" accept="image/*" @change="onWinningImage2Change" />
      </div>

      <!-- Right Bottom: BGM and Actions -->
      <div class="bgm-actions">
        <BgmField label="BGM1" v-model:mode="bgm1Mode" v-model:assetId="formData.bgm1AssetId" :filename="bgm1Filename"
          :assets="audioAssets" @file-change="onBgm1Change" />
        <BgmField label="BGM2" v-model:mode="bgm2Mode" v-model:assetId="formData.bgm2AssetId" :filename="bgm2Filename"
          :assets="audioAssets" @file-change="onBgm2Change" />
        <div class="actions">
          <button @click="submit" :disabled="!isValid">保存</button>
          <button @click="cancel">キャンセル</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import FieldText from '../../../ui/pages/admin/prizes/components/field-text.vue';
import FieldNumberStepper from '../../../ui/pages/admin/prizes/components/field-number-stepper.vue';
import FieldSelect from '../../../ui/pages/admin/prizes/components/field-select.vue';
import ImageField from '../../../ui/pages/admin/prizes/components/image-field.vue';
import BgmField from '../../../ui/pages/admin/prizes/components/bgm-field.vue';
import { useObjectUrlStore } from '@composables/prizes/use-object-url-store';
import { useAssetUpload } from '@composables/prizes/use-asset-upload';
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import type { Asset } from '@model/domains/drive-data/asset-data';

const props = defineProps({
  mode: { type: String as () => 'add' | 'edit', required: true },
  prize: { type: Object, default: null },
  imageAssets: { type: Array as () => Asset[], required: true },
  audioAssets: { type: Array as () => Asset[], required: true },
});

const emit = defineEmits(['submit', 'cancel']);

const { objectUrlMap, createObjectUrl, revoke } = useObjectUrlStore();
const { uploadAsset } = useAssetUpload();
const assetDataService = container.resolve(AssetDataService);

const animationOptions = [
  { value: 'roulette', label: 'ルーレット' },
  { value: 'slot', label: 'スロット' },
];

const formData = ref({
  name: '',
  rank: 5,
  animation: 'roulette',
  imageAssetId: '',
  image2AssetId: '',
  bgm1AssetId: '',
  bgm2AssetId: '',
  winningImage1AssetId: '',
  winningImage2AssetId: '',
});

const image2Mode = ref('upload');
const image2Filename = ref('');
const bgm1Mode = ref('select');
const bgm1Filename = ref('');
const bgm2Mode = ref('select');
const bgm2Filename = ref('');

const tempAsset1 = ref<Asset | null>(null);
const tempAsset2 = ref<Asset | null>(null);
const tempBgm1Asset = ref<Asset | null>(null);
const tempBgm2Asset = ref<Asset | null>(null);
const tempWinningAsset1 = ref<Asset | null>(null);
const tempWinningAsset2 = ref<Asset | null>(null);

const image1Preview = computed(() => objectUrlMap.get('temp-image1') || formData.value.imageAssetId);
const image2Preview = computed(() => objectUrlMap.get('temp-image2') || formData.value.image2AssetId);
const winningImage1Preview = computed(() => objectUrlMap.get('temp-winning-image1') || formData.value.winningImage1AssetId);
const winningImage2Preview = computed(() => objectUrlMap.get('temp-winning-image2') || formData.value.winningImage2AssetId);

const isValid = computed(() => formData.value.name.trim());

watch(() => props.prize, (val) => {
  if (val && props.mode === 'edit') {
    loadPrize(val);
  }
}, { immediate: true });

function loadPrize(prize: any) {
  formData.value = {
    name: prize.name,
    rank: prize.rank,
    animation: prize.animation || 'roulette',
    imageAssetId: prize.imageAssetId || '',
    image2AssetId: prize.image2AssetId || '',
    bgm1AssetId: prize.bgm1AssetId || '',
    bgm2AssetId: prize.bgm2AssetId || '',
    winningImage1AssetId: prize.winningImage1AssetId || '',
    winningImage2AssetId: prize.winningImage2AssetId || '',
  };
  // Modes based on existence
  image2Mode.value = prize.image2AssetId ? 'select' : 'upload';
  bgm1Mode.value = prize.bgm1AssetId ? 'select' : 'upload';
  bgm2Mode.value = prize.bgm2AssetId ? 'select' : 'upload';
}

async function onImage2Change(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await createAssetDto(file);
    tempAsset2.value = dto;
    image2Filename.value = file.name;
    revoke('temp-image2');
    createObjectUrl(file, 'temp-image2');
  }
}

async function onBgm1Change(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempBgm1Asset.value = await createAssetDto(file);
    bgm1Filename.value = file.name;
  }
}

async function onBgm2Change(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    tempBgm2Asset.value = await createAssetDto(file);
    bgm2Filename.value = file.name;
  }
}

async function onWinningImage1Change(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await createAssetDto(file);
    tempWinningAsset1.value = dto;
    revoke('temp-winning-image1');
    createObjectUrl(file, 'temp-winning-image1');
  }
}

async function onWinningImage2Change(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await createAssetDto(file);
    tempWinningAsset2.value = dto;
    revoke('temp-winning-image2');
    createObjectUrl(file, 'temp-winning-image2');
  }
}

async function createAssetDto(file: File): Promise<Asset> {
  return await assetDataService.createDriveDataDtoFromFile(file);
}

async function submit() {
  console.log('submit called');
  if (!isValid.value) return;

  try {
    // Upload temporary assets concurrently
    const uploadPromises = [];
    console.log('tempAsset1.value:', tempAsset1.value);
    console.log('tempAsset2.value:', tempAsset2.value);
    if (tempAsset1.value) uploadPromises.push(uploadAsset(tempAsset1.value).then((result: any) => ({ type: 'image1', result })));
    if (tempAsset2.value) uploadPromises.push(uploadAsset(tempAsset2.value).then((result: any) => ({ type: 'image2', result })));
    if (tempBgm1Asset.value) uploadPromises.push(uploadAsset(tempBgm1Asset.value).then((result: any) => ({ type: 'bgm1', result })));
    if (tempBgm2Asset.value) uploadPromises.push(uploadAsset(tempBgm2Asset.value).then((result: any) => ({ type: 'bgm2', result })));
    if (tempWinningAsset1.value) uploadPromises.push(uploadAsset(tempWinningAsset1.value).then((result: any) => ({ type: 'winningImage1', result })));
    if (tempWinningAsset2.value) uploadPromises.push(uploadAsset(tempWinningAsset2.value).then((result: any) => ({ type: 'winningImage2', result })));

    console.log('uploadPromises length:', uploadPromises.length);
    const results = await Promise.all(uploadPromises);

    // Set uploaded asset IDs into formData
    for (const { type, result } of results) {
      if (type === 'image1') {
        formData.value.imageAssetId = result.assetId;
      } else if (type === 'image2') {
        formData.value.image2AssetId = result.assetId;
      } else if (type === 'bgm1') {
        formData.value.bgm1AssetId = result.assetId;
      } else if (type === 'bgm2') {
        formData.value.bgm2AssetId = result.assetId;
      } else if (type === 'winningImage1') {
        formData.value.winningImage1AssetId = result.assetId;
      } else if (type === 'winningImage2') {
        formData.value.winningImage2AssetId = result.assetId;
      }
    }

    // Clean up temporary object URLs and refs
    revoke('temp-image1');
    revoke('temp-image2');
    revoke('temp-winning-image1');
    revoke('temp-winning-image2');
    tempAsset1.value = null;
    tempAsset2.value = null;
    tempBgm1Asset.value = null;
    tempBgm2Asset.value = null;
    tempWinningAsset1.value = null;
    tempWinningAsset2.value = null;

    emit('submit', formData.value);
  } catch (error) {
    console.error('Failed to upload assets:', error);
    // Optionally emit an error or show UI feedback
  }
}

function cancel() {
  emit('cancel');
}
</script>

<style scoped>
.prize-form {
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 100vh;
}


.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  /* 5 rows: basic-fields / animation (handled inside basic) / images / winning images / bgm */
  grid-template-rows: auto auto auto auto auto;
  gap: 20px;
  padding: 20px;
  min-width: 0;
  min-height: 0;
}

/* ensure grid can shrink and children don't force overflow */
.basic-fields,
.image1-preview,
.image2-section,
.winning-image1-section,
.winning-image2-section,
.bgm-actions {
  min-width: 0;
}

.basic-fields {
  grid-column: 1 / -1;
  grid-row: 1;
  display: grid;
  grid-template-columns: 1fr 140px;
  gap: 12px;
  align-items: center;
}

.basic-fields > .name-field { grid-column: 1; }
.basic-fields > .rank-field { grid-column: 2; }
.basic-fields > .animation-field { grid-column: 1 / -1; margin-top: 8px; }

.image1-preview { grid-column: 1; grid-row: 3; }
.image2-section { grid-column: 2; grid-row: 3; }
.winning-image1-section { grid-column: 1; grid-row: 4; }
.winning-image2-section { grid-column: 2; grid-row: 4; }
.bgm-actions { grid-column: 1 / -1; grid-row: 5; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

.preview-box {
  width: 100%;
  max-width: 220px;
  aspect-ratio: 1 / 1;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.placeholder {
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

@media (max-width: 768px) {
  .form-grid {
    grid-template-columns: 1fr;
    grid-template-rows: repeat(5, auto);
  }
  .basic-fields { grid-template-columns: 1fr; }
  .bgm-actions { grid-template-columns: 1fr; }
  .preview-box { max-width: 100%; }
}
</style>