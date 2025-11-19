<template>
  <div class="modal-overlay">
    <div class="modal-content wide-modal" @click.stop>
      <div class="add-modal-grid">
        <div class="add-form-column">
          <h3>景品詳細</h3>
          <p>景品の情報を編集してください。</p>

          <div class="field-block">
            <label class="field-label">名前</label>
            <input v-model="editName" type="text" placeholder="景品名" class="admin-input prize-name-input" />
          </div>

          <div class="field-block">
            <label class="field-label">景品ランク</label>
            <input v-model.number="editRank" type="number" placeholder="景品ランク" min="1" class="admin-input" />
          </div>

          <div class="field-block left-col">
            <label class="field-label">抽選アニメーション</label>
            <select v-model="editAnimation" class="admin-input">
              <option value="roulette">ルーレット</option>
              <option value="slot">スロット</option>
            </select>
          </div>

          <div class="field-block">
            <label class="field-label">画像1</label>
            <div class="image-mode">
              <div class="image-radio-group">
                <label><input type="radio" v-model="editImageMode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editImageMode" value="select" /> 既存から選択</label>
              </div>
              <div class="image-select-group">
                <select v-if="editImageMode === 'select'" v-model="editImageAssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="editImageMode === 'upload'" type="file" @change="onEditImageChange" accept="image/*" class="admin-input" />
                <span v-if="editImageMode === 'upload' && editImageFilename" class="file-name">{{ editImageFilename }}</span>
              </div>
            </div>
          </div>

          <div class="field-block">
            <label class="field-label">画像2</label>
            <div class="image-mode">
              <div class="image-radio-group">
                <label><input type="radio" v-model="editImage2Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editImage2Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="image-select-group">
                <select v-if="editImage2Mode === 'select'" v-model="editImage2AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="editImage2Mode === 'upload'" type="file" @change="onEditImage2Change" accept="image/*" class="admin-input" />
                <span v-if="editImage2Mode === 'upload' && editImage2Filename" class="file-name">{{ editImage2Filename }}</span>
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">BGM1</label>
            <div class="bgm-mode">
              <div class="bgm-radio-group">
                <label><input type="radio" v-model="editBgm1Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editBgm1Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="bgm-select-group">
                <select v-if="editBgm1Mode === 'select'" v-model="editBgm1AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="editBgm1Mode === 'upload'" type="file" @change="onEditBgm1Change" accept="audio/*" class="admin-input" />
                <span v-if="editBgm1Mode === 'upload' && editBgm1Filename" class="file-name">{{ editBgm1Filename }}</span>
              </div>
            </div>
          </div>

          <div class="field-block span-2">
            <label class="field-label">BGM2</label>
            <div class="bgm-mode">
              <div class="bgm-radio-group">
                <label><input type="radio" v-model="editBgm2Mode" value="upload" /> アップロード</label>
                <label><input type="radio" v-model="editBgm2Mode" value="select" /> 既存から選択</label>
              </div>
              <div class="bgm-select-group">
                <select v-if="editBgm2Mode === 'select'" v-model="editBgm2AssetId" class="admin-input">
                  <option value="">選択なし</option>
                  <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="editBgm2Mode === 'upload'" type="file" @change="onEditBgm2Change" accept="audio/*" class="admin-input" />
                <span v-if="editBgm2Mode === 'upload' && editBgm2Filename" class="file-name">{{ editBgm2Filename }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="add-side-column">
          <div class="preview-box preview-box--small two-image-preview">
            <template v-if="editImagePreview || editImage2Preview">
              <div class="preview-half">
                <img v-if="editImagePreview" :src="editImagePreview" alt="preview1" class="preview-img" />
                <div v-else class="preview-placeholder small">画像1なし</div>
              </div>
              <div class="preview-half">
                <img v-if="editImage2Preview" :src="editImage2Preview" alt="preview2" class="preview-img" />
                <div v-else class="preview-placeholder small">画像2なし</div>
              </div>
            </template>
            <template v-else>
              <div class="preview-placeholder">プレビュー</div>
            </template>
          </div>
        </div>

      </div>

      <div class="modal-footer">
        <div class="footer-left"></div>
        <div class="footer-right admin-modal-buttons">
          <button class="admin-btn" @click="saveEdit">保存</button>
          <button class="admin-btn cancel-primary" @click="closeModal">キャンセル</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import { container } from 'tsyringe';
import type { Asset } from '@model/domains/drive-data/asset-data';

const props = defineProps({
  prize: { type: Object as () => any, required: true },
  imageAssets: { type: Array as () => Asset[], required: true },
  audioAssets: { type: Array as () => Asset[], required: true },
  objectUrlMap: { type: Object, required: true }
});
const emit = defineEmits(['close', 'refresh']);

const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);

const editName = ref('');
const editRank = ref<number>(5);
const editImageAssetId = ref('');
const editImagePreview = ref('');
const editImageMode = ref('upload');
const editImageFilename = ref('');
const editImage2AssetId = ref('');
const editImage2Mode = ref('upload');
const editImage2Filename = ref('');
const editImage2Preview = ref('');
const editBgm1AssetId = ref('');
const editBgm2AssetId = ref('');
const editBgm1Mode = ref('select');
const editBgm2Mode = ref('select');
const editBgm1Filename = ref('');
const editBgm2Filename = ref('');
const editAnimation = ref('roulette');

const editTempAsset = ref<Asset | null>(null);
const editTempAsset2 = ref<Asset | null>(null);
const editTempBgm1Asset = ref<Asset | null>(null);
const editTempBgm2Asset = ref<Asset | null>(null);

const editImagePreviewUrl = ref<string | null>(null);
const editImage2PreviewUrl = ref<string | null>(null);

onMounted(() => {
  if (props.prize) {
    loadPrize(props.prize);
  }
});

watch(() => props.prize, (val) => {
  if (val) loadPrize(val);
});

const loadPrize = async (prize: any) => {
  editName.value = prize.name;
  editRank.value = prize.rank;
  editAnimation.value = prize.animation || 'roulette';
  if (editImagePreviewUrl.value) {
    try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
    editImagePreviewUrl.value = null;
  }
  if (prize.imageAssetId) {
    editImageMode.value = 'select';
    editImageAssetId.value = prize.imageAssetId;
    editImagePreview.value = props.objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId;
  } else {
    editImageMode.value = 'upload';
  }
  editImageFilename.value = '';
  editTempAsset.value = null;

  if (prize.image2AssetId) {
    editImage2Mode.value = 'select';
    editImage2AssetId.value = prize.image2AssetId;
    editImage2Preview.value = props.objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId;
  } else {
    editImage2Mode.value = 'upload';
  }
  editImage2Filename.value = '';
  editTempAsset2.value = null;

  if (prize.bgm1AssetId) {
    editBgm1Mode.value = 'select';
    editBgm1AssetId.value = prize.bgm1AssetId;
  } else {
    editBgm1Mode.value = 'upload';
  }
  if (prize.bgm2AssetId) {
    editBgm2Mode.value = 'select';
    editBgm2AssetId.value = prize.bgm2AssetId;
  } else {
    editBgm2Mode.value = 'upload';
  }
  editBgm1Filename.value = '';
  editBgm2Filename.value = '';
  editTempBgm1Asset.value = null;
  editTempBgm2Asset.value = null;
};

const closeModal = () => {
  emit('close');
};

const onEditImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    editTempAsset.value = dto;
    editImageFilename.value = file.name;
    if (editImagePreviewUrl.value) {
      try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
      editImagePreviewUrl.value = null;
    }
    editImagePreviewUrl.value = URL.createObjectURL(file);
    editImagePreview.value = editImagePreviewUrl.value;
  }
};
const onEditImage2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    editTempAsset2.value = dto;
    editImage2Filename.value = file.name;
    if (editImage2PreviewUrl.value) {
      try { URL.revokeObjectURL(editImage2PreviewUrl.value); } catch { }
      editImage2PreviewUrl.value = null;
    }
    editImage2PreviewUrl.value = URL.createObjectURL(file);
    editImage2Preview.value = editImage2PreviewUrl.value;
  }
};
const onEditBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempBgm1Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
    editBgm1Filename.value = file.name;
  }
};
const onEditBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editTempBgm2Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
    editBgm2Filename.value = file.name;
  }
};

const saveEdit = async () => {
  if (!props.prize) return;
  let assetId: string | undefined;
  if (editTempAsset.value) {
    const updatedAssets = await assetDataService.addAssetData([editTempAsset.value]);
    const updatedAsset = updatedAssets[0];
    editTempAsset.value = updatedAsset;
    assetId = updatedAsset.id;
  }
  let bgm1AssetId: string | undefined;
  if (editTempBgm1Asset.value) {
    const updatedAssets = await assetDataService.addAssetData([editTempBgm1Asset.value]);
    editTempBgm1Asset.value = updatedAssets[0];
    bgm1AssetId = editTempBgm1Asset.value.id;
  }
  let bgm2AssetId: string | undefined;
  if (editTempBgm2Asset.value) {
    const updatedAssets = await assetDataService.addAssetData([editTempBgm2Asset.value]);
    editTempBgm2Asset.value = updatedAssets[0];
    bgm2AssetId = editTempBgm2Asset.value.id;
  }
  let image2AssetId: string | undefined;
  if (editTempAsset2.value) {
    const updatedAssets2 = await assetDataService.addAssetData([editTempAsset2.value]);
    editTempAsset2.value = updatedAssets2[0];
    image2AssetId = editTempAsset2.value.id;
  }

  const updatedPrize = {
    ...props.prize,
    name: editName.value,
    rank: editRank.value,
    animation: editAnimation.value,
    imageAssetId: assetId || editImageAssetId.value,
    image2AssetId: image2AssetId || editImage2AssetId.value,
    bgm1AssetId: bgm1AssetId || editBgm1AssetId.value,
    bgm2AssetId: bgm2AssetId || editBgm2AssetId.value,
  };
  try {
    await prizeService.updatePrize(updatedPrize.id, updatedPrize);
    emit('refresh');
    emit('close');
  } catch (error) {
    console.error("Failed to update prize:", error);
  }
};

</script>

<style scoped>
/* styling is inherited from parent; keep it minimal here */
</style>
