<template>
  <button class="admin-btn mt-4" @click="savePrizes">保存</button>
  <div class="admin-section">
    <h2>景品管理</h2>
    <form class="admin-form" @submit.prevent="addPrize">
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
      <button type="submit" class="admin-btn">追加</button>
    </form>
    <ul class="admin-list">
      <li v-for="(prize, idx) in prizes" :key="idx" class="admin-list-item">
        <span>{{ prize.name }}（{{ prize.rank }}）</span>
        <span v-if="prize.imageAssetId">
          <img :src="prize.imageAssetId" alt="image" style="max-width:40px;max-height:40px;vertical-align:middle;" />
        </span>
        <span v-if="prize.description">説明: {{ prize.description }}</span>
        <span v-if="prize.bgmAssetId">BGM: {{ prize.bgmAssetId }}</span>
        <span v-if="prize.seAssetIds && prize.seAssetIds.length">SE: {{ prize.seAssetIds.join(', ') }}</span>
        <button class="admin-btn ml-2" @click="editPrize(idx)">編集</button>
        <button class="admin-btn ml-2" @click="deletePrize(idx)">削除</button>
      </li>
    </ul>
    <div v-if="editIdx !== null" class="admin-edit-box">
      <h3>景品編集</h3>
      <input v-model="editName" type="text" class="admin-input" />
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
      <button class="admin-btn" @click="saveEdit">保存</button>
      <button class="admin-btn ml-2" @click="cancelEdit">キャンセル</button>
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
    seAssetIds: seAssetIdsInput.value ? seAssetIdsInput.value.split(',').map(a => a.trim()) : []
  } as any);
  prizeName.value = '';
  prizeRank.value = '高';
  imageAssetId.value = '';
  imagePreview.value = '';
  descriptionInput.value = '';
  bgmAssetIdInput.value = '';
  seAssetIdsInput.value = '';
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
};
const cancelEdit = () => {
  editIdx.value = null;
  editName.value = '';
  editRank.value = '高';
  editImageAssetId.value = '';
  editImagePreview.value = '';
  editDescriptionInput.value = '';
  editBgmAssetIdInput.value = '';
  editSeAssetIdsInput.value = '';
};
const deletePrize = (idx: number) => {
  // TODO: API経由で削除する実装に変更
  prizes.value.splice(idx, 1);
};

onMounted(() => {
  fetchPrizes();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.admin-form {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
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

.admin-list {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.admin-list-item {
  background: #232b36;
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
</style>
