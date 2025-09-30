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
          <img v-if="prize.imageAssetId" :src="prize.imageAssetId" alt="image" class="admin-thumbnail"
            @error="onImageError" />
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
      <input v-model="prizeName" type="text" placeholder="景品名" class="admin-input" />
      <label>画像:</label>
      <div class="asset-mode">
        <label><input type="radio" v-model="imageMode" value="upload" /> アップロード</label>
        <label><input type="radio" v-model="imageMode" value="select" /> 既存から選択</label>
      </div>
      <input v-if="imageMode === 'upload'" type="file" @change="onImageChange" accept="image/*" class="admin-input" />
      <select v-if="imageMode === 'select'" v-model="imageAssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
      <div v-if="imagePreview" class="admin-photo-preview">
        <img :src="imagePreview" alt="preview" style="max-width:80px;max-height:80px;" @error="onImageError" />
      </div>
      <label>BGM1:</label>
      <div class="asset-mode">
        <label><input type="radio" v-model="bgm1Mode" value="select" /> 既存から選択</label>
        <label><input type="radio" v-model="bgm1Mode" value="upload" /> アップロード</label>
      </div>
      <select v-if="bgm1Mode === 'select'" v-model="bgm1AssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
      <input v-if="bgm1Mode === 'upload'" type="file" @change="onBgm1Change" accept="audio/*" class="admin-input" />
      <label>BGM2:</label>
      <div class="asset-mode">
        <label><input type="radio" v-model="bgm2Mode" value="select" /> 既存から選択</label>
        <label><input type="radio" v-model="bgm2Mode" value="upload" /> アップロード</label>
      </div>
      <select v-if="bgm2Mode === 'select'" v-model="bgm2AssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
      <input v-if="bgm2Mode === 'upload'" type="file" @change="onBgm2Change" accept="audio/*" class="admin-input" />
      <input v-model.number="prizeProbability" type="number" min="1" max="10" placeholder="当選確率 (1-10)"
        class="admin-input" />
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
import { PrizeService } from '../../../model/applications/prize-service';
import { AssetService } from '../../../model/applications/asset-service';

import { container } from 'tsyringe';
const prizeService = container.resolve(PrizeService);
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
  for (let i = 0; i < prizes.value.length; i++) {
    const prize = prizes.value[i];
    const original = originalPrizes.value[i];
    if (!original || isPrizeChanged(prize, original)) {
      if (!original) {
        await prizeService.addPrize(prize);
      } else {
        await prizeService.updatePrize(prize);
      }
      originalPrizes.value[i] = JSON.parse(JSON.stringify(prize));
    }
  }
};
const fetchPrizes = async () => {
  prizes.value = await prizeService.fetchPrizes();
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
const imagePreview = computed(() => imageAssetId.value);
const bgm1AssetId = ref('');
const bgm2AssetId = ref('');
const assets = ref<any[]>([]);
const imageMode = ref('upload');
const bgm1Mode = ref('select');
const bgm2Mode = ref('select');
const fetchAssets = async () => {
  try {
    assets.value = await assetService.fetchAssets();
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
const onImageChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      imageAssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const onBgm1Change = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      bgm1AssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const onBgm2Change = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      bgm2AssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const addPrize = () => {
  if (!prizeName.value) return;
  prizes.value.push({
    name: prizeName.value,
    probability: prizeProbability.value,
    imageAssetId: imageAssetId.value,
    bgm1AssetId: bgm1AssetId.value,
    bgm2AssetId: bgm2AssetId.value,
    order: prizes.value.length + 1
  } as any);
  prizeName.value = '';
  prizeProbability.value = 5;
  imageAssetId.value = '';
  bgm1AssetId.value = '';
  bgm2AssetId.value = '';
  showAddModal.value = false;
  sortPrizes();
};
const editIdx = ref<number | null>(null);
const editName = ref('');
const editProbability = ref(5);
const editImageAssetId = ref('');
const editImagePreview = computed(() => editImageAssetId.value);
const editBgm1AssetId = ref('');
const editBgm2AssetId = ref('');
const editImageMode = ref('upload');
const editBgm1Mode = ref('select');
const editBgm2Mode = ref('select');
const onEditImageChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editImageAssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const onEditBgm1Change = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editBgm1AssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const onEditBgm2Change = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editBgm2AssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const editPrize = (idx: number) => {
  editIdx.value = idx;
  const prize = prizes.value[idx];
  editName.value = prize.name;
  editProbability.value = prize.probability;
  editImageAssetId.value = prize.imageAssetId || '';
  editImageMode.value = prize.imageAssetId && !prize.imageAssetId.startsWith('data:') ? 'select' : 'upload';
  editBgm1AssetId.value = prize.bgm1AssetId || '';
  editBgm1Mode.value = prize.bgm1AssetId && !prize.bgm1AssetId.startsWith('data:') ? 'select' : 'upload';
  editBgm2AssetId.value = prize.bgm2AssetId || '';
  editBgm2Mode.value = prize.bgm2AssetId && !prize.bgm2AssetId.startsWith('data:') ? 'select' : 'upload';
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  prizes.value[editIdx.value] = {
    name: editName.value,
    probability: editProbability.value,
    imageAssetId: editImageAssetId.value,
    bgm1AssetId: editBgm1AssetId.value,
    bgm2AssetId: editBgm2AssetId.value
  } as any;
  editIdx.value = null;
  editName.value = '';
  editProbability.value = 5;
  editImageAssetId.value = '';
  editBgm1AssetId.value = '';
  editBgm2AssetId.value = '';
  sortPrizes();
};

onMounted(() => {
  fetchPrizes();
  fetchAssets();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.admin-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
}

.admin-input {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

.admin-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.admin-btn:hover {
  background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.admin-btn:disabled {
  background: #555;
  cursor: not-allowed;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.admin-card {
  background: #232b36;
  color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.admin-checkbox {
  margin-bottom: 8px;
}

.admin-card-content {
  width: 100%;
}

.admin-thumbnail {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 8px;
}

.admin-thumbnail-placeholder {
  width: 100%;
  height: 150px;
  background: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-bottom: 8px;
  color: #ccc;
}

.admin-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
}

.admin-card p {
  margin: 0 0 8px 0;
  color: #ccc;
}

.admin-modal {
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

.admin-modal-content {
  background: #232b36;
  color: #fff;
  padding: 32px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.admin-modal-content h3 {
  margin-top: 0;
  margin-bottom: 24px;
}

.admin-modal-content .admin-input,
.admin-modal-content .admin-photo-preview {
  margin-bottom: 30px;
}

.admin-input[type="file"] {
  padding: 10px 16px;
  border-radius: 8px;
  border: 2px dashed #555;
  background: #232b36;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.admin-input[type="file"]:hover {
  border-color: #4f8cff;
}

.admin-input[type="file"]::-webkit-file-upload-button {
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-right: 10px;
}

.admin-input[type="file"]::-webkit-file-upload-button:hover {
  background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.admin-modal-buttons {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 34px;
}

.asset-mode {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}

.asset-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
