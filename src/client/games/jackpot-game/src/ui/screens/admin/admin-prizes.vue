<template>
  <button class="admin-btn mt-4" @click="savePrizes">保存</button>
  <div class="admin-section">
    <h2>景品管理</h2>
    <div class="admin-controls">
      <select v-model="sortBy" @change="sortPrizes" class="admin-input">
        <option value="name">名前順</option>
        <option value="probability">確率順</option>
        <option value="order">追加順</option>
      </select>
      <button class="admin-btn" @click="showAddModal = true">追加</button>
      <button class="admin-btn" @click="bulkDelete" :disabled="selectedPrizes.length === 0">一括削除</button>
    </div>
    <div class="admin-grid">
      <div v-for="(prize, idx) in prizes" :key="idx" class="admin-card">
        <input type="checkbox" v-model="selectedPrizes" :value="idx" class="admin-checkbox" />
        <div class="admin-card-content">
          <img v-if="prize.imageDataUrl || prize.imageAssetId" :src="prize.imageDataUrl || prize.imageAssetId"
            alt="image" class="admin-thumbnail" @error="onImageError" />
          <div v-else class="admin-thumbnail-placeholder">No Image</div>
          <h3>{{ prize.name }}</h3>
          <p>当選確率: {{ prize.probability }}/10</p>
          <button class="admin-btn" @click="editPrize(idx)">編集</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 追加モーダル -->
  <div v-if="showAddModal" class="admin-modal" @click="showAddModal = false">
    <div class="admin-modal-content" @click.stop>
      <h3>景品追加</h3>
      <div class="form-row">
        <label class="field-label">景品名</label>
        <input v-model="prizeName" type="text" placeholder="景品名" class="admin-input" />
      </div>

      <div class="form-row">
        <label class="field-label">画像</label>
        <div class="asset-mode">
          <label><input type="radio" v-model="imageMode" value="upload" /> アップロード</label>
          <label><input type="radio" v-model="imageMode" value="select" /> 既存から選択</label>
        </div>
        <div class="form-control">
          <input v-if="imageMode === 'upload'" type="file" @change="onImageChange" accept="image/*"
            class="admin-input" />
          <select v-if="imageMode === 'select'" v-model="imageAssetId" class="admin-input">
            <option value="">選択なし</option>
            <option v-for="asset in imageAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
          </select>
        </div>
        <div v-if="imagePreview" class="admin-photo-preview">
          <img :src="imagePreview" alt="preview" style="max-width:80px;max-height:80px;" @error="onImageError" />
        </div>
      </div>

      <div class="form-row">
        <label class="field-label">BGM1</label>
        <div class="asset-mode">
          <label><input type="radio" v-model="bgm1Mode" value="select" /> 既存から選択</label>
          <label><input type="radio" v-model="bgm1Mode" value="upload" /> アップロード</label>
        </div>
        <div class="form-control">
          <select v-if="bgm1Mode === 'select'" v-model="bgm1AssetId" class="admin-input">
            <option value="">選択なし</option>
            <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
          </select>
          <input v-if="bgm1Mode === 'upload'" type="file" @change="onBgm1Change" accept="audio/*" class="admin-input" />
        </div>
      </div>

      <div class="form-row">
        <label class="field-label">BGM2</label>
        <div class="asset-mode">
          <label><input type="radio" v-model="bgm2Mode" value="select" /> 既存から選択</label>
          <label><input type="radio" v-model="bgm2Mode" value="upload" /> アップロード</label>
        </div>
        <div class="form-control">
          <select v-if="bgm2Mode === 'select'" v-model="bgm2AssetId" class="admin-input">
            <option value="">選択なし</option>
            <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
          </select>
          <input v-if="bgm2Mode === 'upload'" type="file" @change="onBgm2Change" accept="audio/*" class="admin-input" />
        </div>
      </div>

      <div class="form-row">
        <label class="field-label">当選確率</label>
        <input v-model.number="prizeProbability" type="number" min="1" max="10" placeholder="当選確率 (1-10)"
          class="admin-input" />
      </div>
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="addPrize">追加</button>
        <button class="admin-btn" @click="showAddModal = false">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 編集モーダル -->
  <div v-if="editIdx !== null" class="admin-modal" @click="editIdx = null">
    <div class="admin-modal-content" @click.stop>
      <h3>景品編集</h3>
      <input v-model="editName" type="text" placeholder="景品名" class="admin-input" />
      <label>画像:</label>
      <div class="asset-mode">
        <label><input type="radio" v-model="editImageMode" value="upload" /> アップロード</label>
        <label><input type="radio" v-model="editImageMode" value="select" /> 既存から選択</label>
      </div>
      <input v-if="editImageMode === 'upload'" type="file" @change="onEditImageChange" accept="image/*"
        class="admin-input" />
      <select v-if="editImageMode === 'select'" v-model="editImageAssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
      <div v-if="editImagePreview" class="admin-photo-preview">
        <img :src="editImagePreview" alt="preview" style="max-width:80px;max-height:80px;" @error="onImageError" />
      </div>
      <label>BGM1:</label>
      <div class="asset-mode">
        <label><input type="radio" v-model="editBgm1Mode" value="select" /> 既存から選択</label>
        <label><input type="radio" v-model="editBgm1Mode" value="upload" /> アップロード</label>
      </div>
      <select v-if="editBgm1Mode === 'select'" v-model="editBgm1AssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
      <input v-if="editBgm1Mode === 'upload'" type="file" @change="onEditBgm1Change" accept="audio/*"
        class="admin-input" />
      <label>BGM2:</label>
      <div class="asset-mode">
        <label><input type="radio" v-model="editBgm2Mode" value="select" /> 既存から選択</label>
        <label><input type="radio" v-model="editBgm2Mode" value="upload" /> アップロード</label>
      </div>
      <select v-if="editBgm2Mode === 'select'" v-model="editBgm2AssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
      <input v-if="editBgm2Mode === 'upload'" type="file" @change="onEditBgm2Change" accept="audio/*"
        class="admin-input" />
      <input v-model.number="editProbability" type="number" min="1" max="10" placeholder="当選確率 (1-10)"
        class="admin-input" />
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="saveEdit">保存</button>
        <button class="admin-btn" @click="editIdx = null">キャンセル</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { IPrizeRepository } from '../../../model/domains/prize/repository/IPrizeRepository';
import { AssetService } from '../../../model/applications/asset/asset-service';
import { AssetDto } from '../../../model/applications/asset/dto/asset-dto';

import { container } from 'tsyringe';
const prizeRepo = container.resolve<IPrizeRepository>("IPrizeRepository");
const assetService = container.resolve(AssetService);
const prizes = ref<any[]>([]);
const originalPrizes = ref<any[]>([]);
const selectedPrizes = ref<number[]>([]);
const sortBy = ref('name');
const showAddModal = ref(false);
const isPrizeChanged = (prize: any, original: any) => {
  return JSON.stringify(prize) !== JSON.stringify(original);
};
const savePrizes = async () => {
  const toAdd = prizes.value.filter(p => !originalPrizes.value.find((o: any) => o.id === p.id));
  const toUpdate = prizes.value.filter(p => {
    const original = originalPrizes.value.find((o: any) => o.id === p.id);
    return original && isPrizeChanged(p, original);
  });
  const toDelete = originalPrizes.value.filter((o: any) => !prizes.value.find((p: any) => p.id === o.id));
  if (toAdd.length > 0) await prizeRepo.addPrizes(toAdd);
  if (toUpdate.length > 0) await prizeRepo.updatePrizes(toUpdate.map(u => ({ id: u.id, updateFn: () => u })));
  if (toDelete.length > 0) await prizeRepo.deletePrizes(toDelete.map(d => d.id));
  originalPrizes.value = JSON.parse(JSON.stringify(prizes.value));
};
const fetchPrizes = async () => {
  prizes.value = await prizeRepo.getPrizes();
  originalPrizes.value = JSON.parse(JSON.stringify(prizes.value));
  sortPrizes();
};
const sortPrizes = () => {
  if (sortBy.value === 'name') {
    prizes.value.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy.value === 'probability') {
    prizes.value.sort((a, b) => b.probability - a.probability);
  } else if (sortBy.value === 'order') {
    prizes.value.sort((a, b) => a.order - b.order);
  }
};
const bulkDelete = () => {
  selectedPrizes.value.sort((a, b) => b - a);
  for (const idx of selectedPrizes.value) {
    prizes.value.splice(idx, 1);
  }
  selectedPrizes.value = [];
};
const prizeName = ref('');
const prizeProbability = ref(5);
const imageAssetId = ref('');
const imageAsset = ref<AssetDto | undefined>();
const imagePreview = ref('');
const bgm1AssetId = ref('');
const bgm1Asset = ref<AssetDto | undefined>();
const bgm2AssetId = ref('');
const bgm2Asset = ref<AssetDto | undefined>();
const assets = ref<any[]>([]);
const imageMode = ref('upload');
const bgm1Mode = ref('select');
const bgm2Mode = ref('select');
const fetchAssets = async () => {
  try {
    assets.value = await assetService.getAllAssets();
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    assets.value = [];
  }
};
const audioAssets = computed(() => assets.value.filter(asset => asset.type === 'audio'));
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));
const onImageError = (event: Event) => {
  const img = event.target as HTMLImageElement;
  img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNTU1Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjY2NjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
  img.alt = 'No Image';
};
const onImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    imageAsset.value = new AssetDto(file);
    imagePreview.value = await imageAsset.value.dataUrl;
  }
};
const onBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    bgm1Asset.value = new AssetDto(file);
  }
};
const onBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    bgm2Asset.value = new AssetDto(file);
  }
};
const addPrize = () => {
  if (!prizeName.value) return;
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
  if (bgm1Mode.value === 'upload' && bgm1Asset.value) {
    newPrize.bgm1Asset = bgm1Asset.value;
  } else if (bgm1Mode.value === 'select' && bgm1AssetId.value) {
    newPrize.bgm1AssetId = bgm1AssetId.value;
  }
  if (bgm2Mode.value === 'upload' && bgm2Asset.value) {
    newPrize.bgm2Asset = bgm2Asset.value;
  } else if (bgm2Mode.value === 'select' && bgm2AssetId.value) {
    newPrize.bgm2AssetId = bgm2AssetId.value;
  }
  prizes.value.push(newPrize);
  prizeName.value = '';
  prizeProbability.value = 5;
  imageAssetId.value = '';
  imageAsset.value = undefined;
  imagePreview.value = '';
  bgm1AssetId.value = '';
  bgm1Asset.value = undefined;
  bgm2AssetId.value = '';
  bgm2Asset.value = undefined;
  showAddModal.value = false;
  sortPrizes();
};
const editIdx = ref<number | null>(null);
const editName = ref('');
const editProbability = ref(5);
const editImageAssetId = ref('');
const editImageAsset = ref<AssetDto | undefined>();
const editImagePreview = ref('');
const editBgm1AssetId = ref('');
const editBgm1Asset = ref<AssetDto | undefined>();
const editBgm2AssetId = ref('');
const editBgm2Asset = ref<AssetDto | undefined>();
const editImageMode = ref('upload');
const editBgm1Mode = ref('select');
const editBgm2Mode = ref('select');
const onEditImageChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editImageAsset.value = new AssetDto(file);
    editImagePreview.value = await editImageAsset.value.dataUrl;
  }
};
const onEditBgm1Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editBgm1Asset.value = new AssetDto(file);
  }
};
const onEditBgm2Change = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editBgm2Asset.value = new AssetDto(file);
  }
};
const editPrize = (idx: number) => {
  editIdx.value = idx;
  const prize = prizes.value[idx];
  editName.value = prize.name;
  editProbability.value = prize.probability;
  editImageAssetId.value = prize.imageAssetId || '';
  editImageAsset.value = prize.imageAsset;
  if (editImageAsset.value) {
    editImageAsset.value.dataUrl.then(url => editImagePreview.value = url);
  }
  editBgm1AssetId.value = prize.bgm1AssetId || '';
  editBgm1Asset.value = prize.bgm1Asset;
  editBgm2AssetId.value = prize.bgm2AssetId || '';
  editBgm2Asset.value = prize.bgm2Asset;
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  const updatedPrize: any = {
    name: editName.value,
    probability: editProbability.value,
    order: prizes.value[editIdx.value].order
  };
  if (editImageAsset.value) {
    updatedPrize.imageAsset = editImageAsset.value;
  } else if (editImageAssetId.value) {
    updatedPrize.imageAssetId = editImageAssetId.value;
  }
  if (editBgm1Asset.value) {
    updatedPrize.bgm1Asset = editBgm1Asset.value;
  } else if (editBgm1AssetId.value) {
    updatedPrize.bgm1AssetId = editBgm1AssetId.value;
  }
  if (editBgm2Asset.value) {
    updatedPrize.bgm2Asset = editBgm2Asset.value;
  } else if (editBgm2AssetId.value) {
    updatedPrize.bgm2AssetId = editBgm2AssetId.value;
  }
  prizes.value[editIdx.value] = { ...prizes.value[editIdx.value], ...updatedPrize };
  editIdx.value = null;
  editName.value = '';
  editProbability.value = 5;
  editImageAssetId.value = '';
  editImageAsset.value = undefined;
  editImagePreview.value = '';
  editBgm1AssetId.value = '';
  editBgm1Asset.value = undefined;
  editBgm2AssetId.value = '';
  editBgm2Asset.value = undefined;
  sortPrizes();
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
