<template>
  <div class="admin-section">
    <h2>景品設定</h2>
    <form class="admin-form" @submit.prevent="addPrizes">
      <div class="prize-input-group">
        <input v-model="prizeName" type="text" placeholder="景品名" class="admin-input prize-name-input" />
        <input v-model.number="prizeProbability" type="number" placeholder="確率 (1-10)" min="1" max="10"
          class="admin-input" />
        <div class="image-mode">
          <label><input type="radio" v-model="imageMode" value="upload" /> アップロード</label>
          <label><input type="radio" v-model="imageMode" value="select" /> 既存から選択</label>
        </div>
        <input v-if="imageMode === 'upload'" type="file" @change="onImageChange" accept="image/*" class="admin-input" />
        <select v-if="imageMode === 'select'" v-model="imageAssetId" class="admin-input">
          <option value="">選択なし</option>
          <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
        <button type="submit" class="admin-btn" :disabled="!prizeName.trim() || !prizeProbability">追加</button>
      </div>
    </form>
    <div class="admin-actions">
      <button class="admin-btn delete-btn" @click="deleteSelectedPrizes"
        :disabled="!selectedPrizes.length">選択した景品を削除</button>
      <button class="admin-btn delete-all-btn" @click="deleteAllPrizes"
        :disabled="!prizes.length || deleteAllDeleting">全件削除</button>
    </div>
    <ul class="admin-list">
      <li v-for="prize in prizes" :key="prize.id" class="admin-list-item">
        <input type="checkbox" v-model="selectedPrizes" :value="prize.id" />
        <div class="prize-preview">
          <img v-if="prize.imageDataUrl || prize.imageAssetId" :src="prize.imageDataUrl || prize.imageAssetId"
            alt="image" class="preview-img" @error="onImageError" />
          <span v-else>{{ prize.name }}</span>
        </div>
        <div class="prize-info">
          <span>{{ prize.name }} (確率: {{ prize.probability }}/10)</span>
        </div>
        <button class="admin-btn" @click="editPrize(prize)">詳細</button>
      </li>
    </ul>
  </div>

  <!-- 詳細モーダル -->
  <div v-if="editPrizeData" class="modal-overlay" @click="editPrizeData = null">
    <div class="modal-content" @click.stop>
      <h3>景品詳細</h3>
      <input v-model="editName" type="text" placeholder="景品名" class="admin-input" />
      <input v-model.number="editProbability" type="number" placeholder="確率 (1-10)" min="1" max="10"
        class="admin-input" />
      <div class="image-mode">
        <label><input type="radio" v-model="editImageMode" value="upload" /> アップロード</label>
        <label><input type="radio" v-model="editImageMode" value="select" /> 既存から選択</label>
      </div>
      <input v-if="editImageMode === 'upload'" type="file" @change="onEditImageChange" accept="image/*"
        class="admin-input" />
      <select v-if="editImageMode === 'select'" v-model="editImageAssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
      </select>
      <div v-if="editImagePreview" class="admin-photo-preview">
        <img :src="editImagePreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="saveEdit">保存</button>
        <button class="admin-btn" @click="editPrizeData = null">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 全件削除モーダル -->
  <div v-if="deleteAllDeleting" class="modal-overlay">
    <div class="modal-content">
      <h3>全件削除中...</h3>
      <p>{{ deleteAllMessage }}</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { IPrizeRepository } from '../../../model/domains/prize/repository/IPrizeRepository';
import { AssetDto } from '../../../model/applications/asset/dto/asset-dto';
import { AssetService } from '../../../model/applications/asset/asset-service';

import { container } from 'tsyringe';
const prizeRepo = container.resolve<IPrizeRepository>("IPrizeRepository");
const assetService = container.resolve(AssetService);
const prizes = ref<any[]>([]);
const selectedPrizes = ref<string[]>([]);
const assets = ref<any[]>([]);
const imageMode = ref('upload');
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));
const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNTU1Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjY2NjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  img.alt = 'No Image';
};

const fetchPrizes = async () => {
  try {
    prizes.value = await prizeRepo.getPrizes();
  } catch (error) {
    console.error("Failed to fetch prizes:", error);
    prizes.value = [];
  }
};

const fetchAssets = async () => {
  try {
    assets.value = await assetService.getAllAssets();
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    assets.value = [];
  }
};

const prizeName = ref('');
const prizeProbability = ref(5);
const imageAssetId = ref('');
const imageAsset = ref<AssetDto | undefined>();
const onImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    imageAsset.value = new AssetDto(file);
  }
};

const addPrizes = async () => {
  if (!prizeName.value.trim() || !prizeProbability.value) return;
  const newPrize: any = {
    id: String(Date.now()),
    name: prizeName.value,
    probability: prizeProbability.value,
    order: prizes.value.length + 1
  };
  if (imageMode.value === 'upload' && imageAsset.value) {
    newPrize.imageAsset = imageAsset.value;
  } else if (imageMode.value === 'select' && imageAssetId.value) {
    newPrize.imageAssetId = imageAssetId.value;
  }
  try {
    await prizeRepo.addPrizes([newPrize]);
    await fetchPrizes();
    prizeName.value = '';
    prizeProbability.value = 5;
    imageAsset.value = undefined;
    imageAssetId.value = '';
  } catch (error) {
    console.error("Failed to add prize:", error);
  }
};

const deleteSelectedPrizes = async () => {
  if (!selectedPrizes.value.length) return;
  try {
    await prizeRepo.deletePrizes(selectedPrizes.value);
    await fetchPrizes();
    selectedPrizes.value = [];
  } catch (error) {
    console.error("Failed to delete prizes:", error);
  }
};

const deleteAllDeleting = ref(false);
const deleteAllMessage = ref('');

const deleteAllPrizes = async () => {
  if (!prizes.value.length) return;
  deleteAllDeleting.value = true;
  deleteAllMessage.value = '景品を削除しています...';
  try {
    await prizeRepo.deletePrizes(prizes.value.map(p => p.id));
    await fetchPrizes();
  } catch (error) {
    console.error("Failed to delete all prizes:", error);
  } finally {
    deleteAllDeleting.value = false;
  }
};

const editPrizeData = ref<any>(null);
const editName = ref('');
const editProbability = ref(5);
const editImageAssetId = ref('');
const editImageAsset = ref<AssetDto | undefined>();
const editImagePreview = ref('');
const editImageMode = ref('upload');

const onEditImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editImageAsset.value = new AssetDto(file);
    editImagePreview.value = await editImageAsset.value.dataUrl;
  }
};

const editPrize = (prize: any) => {
  editPrizeData.value = prize;
  editName.value = prize.name;
  editProbability.value = prize.probability;
  if (prize.imageAssetId) {
    editImageMode.value = 'select';
    editImageAssetId.value = prize.imageAssetId;
    editImagePreview.value = prize.imageAssetId;
  } else {
    editImageMode.value = 'upload';
    editImageAsset.value = prize.imageAsset;
    if (editImageAsset.value) {
      editImageAsset.value.dataUrl.then(url => editImagePreview.value = url);
    }
  }
};

const saveEdit = async () => {
  if (!editPrizeData.value) return;
  const updatedPrize = {
    ...editPrizeData.value,
    name: editName.value,
    probability: editProbability.value
  };
  if (editImageMode.value === 'upload' && editImageAsset.value) {
    updatedPrize.imageAsset = editImageAsset.value;
  } else if (editImageMode.value === 'select' && editImageAssetId.value) {
    updatedPrize.imageAssetId = editImageAssetId.value;
  }
  try {
    await prizeRepo.updatePrizes([{ id: updatedPrize.id, updateFn: () => updatedPrize }]);
    await fetchPrizes();
    editPrizeData.value = null;
    editName.value = '';
    editProbability.value = 5;
    editImageAsset.value = undefined;
    editImageAssetId.value = '';
    editImagePreview.value = '';
  } catch (error) {
    console.error("Failed to update prize:", error);
  }
};

onMounted(() => {
  fetchPrizes();
  fetchAssets();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 28px;
}

.admin-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  align-items: center;
  flex-wrap: wrap;
}

.admin-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.98rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

.admin-btn {
  padding: 9px 16px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.18s, transform 0.12s;
}

.admin-btn:hover {
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.14);
}

.admin-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

.admin-card {
  background: #232b36;
  color: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  gap: 12px;
  align-items: center;
}

.admin-checkbox {
  margin-left: 4px;
}

.admin-card-content {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.admin-thumbnail {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
  flex: 0 0 96px;
}

.admin-thumbnail-placeholder {
  width: 96px;
  height: 96px;
  background: #2f3438;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #bfcbdc;
  flex: 0 0 96px;
}

.admin-card h3 {
  margin: 0;
  font-size: 1.05rem;
}

.admin-card p {
  margin: 6px 0 0 0;
  color: #c9d7e6;
}

.admin-card-content button {
  margin-left: auto;
}

.admin-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.54);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.admin-modal-content {
  background: #232b36;
  color: #fff;
  padding: 28px;
  border-radius: 10px;
  max-width: 720px;
  width: 92%;
  max-height: 80vh;
  overflow-y: auto;
}

.admin-modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.admin-modal-content .admin-input,
.admin-modal-content .admin-photo-preview {
  margin-bottom: 20px;
}

/* form layout for modal fields */
.form-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}

.field-label {
  font-size: 0.95rem;
  color: #dbe8ff;
  font-weight: 700;
}

.form-control {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.admin-input[type="file"] {
  padding: 10px 12px;
  border-radius: 8px;
  border: 2px dashed #434b51;
  background: #232b36;
  color: #fff;
  cursor: pointer;
}

.admin-input[type="file"]:hover {
  border-color: #4f8cff;
}

.admin-input[type="file"]::-webkit-file-upload-button {
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  margin-right: 8px;
}

.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 18px;
}

.asset-mode {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}

.asset-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
