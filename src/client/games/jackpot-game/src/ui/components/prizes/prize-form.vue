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
        <FieldText v-model="formData.name" label="名前" placeholder="景品名" />
        <FieldNumberStepper v-model="formData.rank" :min="1" label="景品ランク" />
        <FieldSelect v-model="formData.animation" :options="animationOptions" label="抽選アニメーション" />
      </div>

      <!-- Left Bottom: Image2 -->
      <div class="image2-section">
        <ImageField label="画像2" v-model:mode="image2Mode" v-model:assetId="formData.image2AssetId"
          :filename="image2Filename" :preview="image2Preview" :assets="imageAssets" @file-change="onImage2Change" />
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
});

const image1Mode = ref('upload');
const image1Filename = ref('');
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

const image1Preview = computed(() => objectUrlMap.get('temp-image1') || formData.value.imageAssetId);
const image2Preview = computed(() => objectUrlMap.get('temp-image2') || formData.value.image2AssetId);

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
  };
  // Modes based on existence
  image1Mode.value = prize.imageAssetId ? 'select' : 'upload';
  image2Mode.value = prize.image2AssetId ? 'select' : 'upload';
  bgm1Mode.value = prize.bgm1AssetId ? 'select' : 'upload';
  bgm2Mode.value = prize.bgm2AssetId ? 'select' : 'upload';
}

async function onImage1Change(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await createAssetDto(file);
    tempAsset1.value = dto;
    image1Filename.value = file.name;
    revoke('temp-image1');
    createObjectUrl(file, 'temp-image1');
  }
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
    if (tempAsset1.value) uploadPromises.push(uploadAsset(tempAsset1.value).then(result => ({ type: 'image1', result })));
    if (tempAsset2.value) uploadPromises.push(uploadAsset(tempAsset2.value).then(result => ({ type: 'image2', result })));
    if (tempBgm1Asset.value) uploadPromises.push(uploadAsset(tempBgm1Asset.value).then(result => ({ type: 'bgm1', result })));
    if (tempBgm2Asset.value) uploadPromises.push(uploadAsset(tempBgm2Asset.value).then(result => ({ type: 'bgm2', result })));

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
      }
    }

    // Clean up temporary object URLs and refs
    revoke('temp-image1');
    revoke('temp-image2');
    tempAsset1.value = null;
    tempAsset2.value = null;
    tempBgm1Asset.value = null;
    tempBgm2Asset.value = null;

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
  grid-template-rows: auto auto;
  gap: 20px;
  padding: 20px;
}

.image1-preview {
  grid-column: 1;
  grid-row: 1;
}

.basic-fields {
  grid-column: 2;
  grid-row: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.image2-section {
  grid-column: 1;
  grid-row: 2;
}

.bgm-actions {
  grid-column: 2;
  grid-row: 2;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-box {
  width: 200px;
  height: 200px;
  border: 1px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-box img {
  max-width: 100%;
  max-height: 100%;
}

.placeholder {
  color: #999;
}

.actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
</style>