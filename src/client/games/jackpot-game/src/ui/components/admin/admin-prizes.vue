<template>
  <button class="admin-btn mt-4" @click="savePrizes">保存</button>
  <div class="admin-section">
    <h2>景品管理</h2>
    <div class="admin-controls">
      <select v-model="sortBy" @change="sortPrizes" class="admin-input">
        <option value="name">名前順</option>
        <option value="rank">ランク順</option>
        <option value="order">追加順</option>
      </select>
      <button class="admin-btn" @click="showAddModal = true">追加</button>
      <button class="admin-btn" @click="bulkDelete" :disabled="selectedPrizes.length === 0">一括削除</button>
    </div>
    <div class="admin-grid">
      <div v-for="(prize, idx) in prizes" :key="idx" class="admin-card">
        <input type="checkbox" v-model="selectedPrizes" :value="idx" class="admin-checkbox" />
        <div class="admin-card-content">
          <img v-if="prize.imageAssetId" :src="prize.imageAssetId" alt="image" class="admin-thumbnail" />
          <div v-else class="admin-thumbnail-placeholder">No Image</div>
          <h3>{{ prize.name }}</h3>
          <p>ランク: {{ prize.rank }}</p>
          <p v-if="prize.description">説明: {{ prize.description }}</p>
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
      <input type="file" @change="onImageChange" accept="image/*" class="admin-input" />
      <div v-if="imagePreview" class="admin-photo-preview">
        <img :src="imagePreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <input v-model="descriptionInput" type="text" placeholder="説明" class="admin-input" />
      <input v-model="bgmAssetIdInput" type="text" placeholder="BGM Asset ID" class="admin-input" />
      <input v-model="seAssetIdsInput" type="text" placeholder="SE Asset IDs（カンマ区切り）" class="admin-input" />
      <select v-model="prizeRank" class="admin-input">
        <option value="高">高</option>
        <option value="中">中</option>
        <option value="低">低</option>
      </select>
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
      <select v-model="editRank" class="admin-input">
        <option value="高">高</option>
        <option value="中">中</option>
        <option value="低">低</option>
      </select>
      <input type="file" @change="onEditImageChange" accept="image/*" class="admin-input" />
      <div v-if="editImagePreview" class="admin-photo-preview">
        <img :src="editImagePreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <input v-model="editDescriptionInput" type="text" placeholder="説明" class="admin-input" />
      <input v-model="editBgmAssetIdInput" type="text" placeholder="BGM Asset ID" class="admin-input" />
      <input v-model="editSeAssetIdsInput" type="text" placeholder="SE Asset IDs（カンマ区切り）" class="admin-input" />
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="saveEdit">保存</button>
        <button class="admin-btn" @click="editIdx = null">キャンセル</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PrizeService } from '../../../model/applications/prize-service';

import { container } from 'tsyringe';
const prizeService = container.resolve(PrizeService);
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
  } else if (sortBy.value === 'rank') {
    const rankOrder: Record<string, number> = { '高': 1, '中': 2, '低': 3 };
    prizes.value.sort((a, b) => rankOrder[a.rank] - rankOrder[b.rank]);
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
const prizeRank = ref('高');
const imageAssetId = ref('');
const imagePreview = ref('');
const descriptionInput = ref('');
const bgmAssetIdInput = ref('');
const seAssetIdsInput = ref('');
const onImageChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      imagePreview.value = ev.target?.result as string;
      imageAssetId.value = imagePreview.value;
    };
    reader.readAsDataURL(file);
  }
};
const addPrize = () => {
  if (!prizeName.value) return;
  prizes.value.push({
    name: prizeName.value,
    rank: prizeRank.value,
    imageAssetId: imageAssetId.value,
    description: descriptionInput.value,
    bgmAssetId: bgmAssetIdInput.value,
    seAssetIds: seAssetIdsInput.value ? seAssetIdsInput.value.split(',').map(a => a.trim()) : [],
    order: prizes.value.length + 1
  } as any);
  prizeName.value = '';
  prizeRank.value = '高';
  imageAssetId.value = '';
  imagePreview.value = '';
  descriptionInput.value = '';
  bgmAssetIdInput.value = '';
  seAssetIdsInput.value = '';
  showAddModal.value = false;
  sortPrizes();
};
const editIdx = ref<number | null>(null);
const editName = ref('');
const editRank = ref('高');
const editImageAssetId = ref('');
const editImagePreview = ref('');
const editDescriptionInput = ref('');
const editBgmAssetIdInput = ref('');
const editSeAssetIdsInput = ref('');
const onEditImageChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editImagePreview.value = ev.target?.result as string;
      editImageAssetId.value = editImagePreview.value;
    };
    reader.readAsDataURL(file);
  }
};
const editPrize = (idx: number) => {
  editIdx.value = idx;
  const prize = prizes.value[idx];
  editName.value = prize.name;
  editRank.value = prize.rank;
  editImageAssetId.value = prize.imageAssetId || '';
  editImagePreview.value = prize.imageAssetId || '';
  editDescriptionInput.value = prize.description || '';
  editBgmAssetIdInput.value = prize.bgmAssetId || '';
  editSeAssetIdsInput.value = prize.seAssetIds ? prize.seAssetIds.join(', ') : '';
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  prizes.value[editIdx.value] = {
    name: editName.value,
    rank: editRank.value,
    imageAssetId: editImageAssetId.value,
    description: editDescriptionInput.value,
    bgmAssetId: editBgmAssetIdInput.value,
    seAssetIds: editSeAssetIdsInput.value ? editSeAssetIdsInput.value.split(',').map(a => a.trim()) : []
  } as any;
  editIdx.value = null;
  editName.value = '';
  editRank.value = '高';
  editImageAssetId.value = '';
  editImagePreview.value = '';
  editDescriptionInput.value = '';
  editBgmAssetIdInput.value = '';
  editSeAssetIdsInput.value = '';
  sortPrizes();
};

onMounted(() => {
  fetchPrizes();
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
</style>
