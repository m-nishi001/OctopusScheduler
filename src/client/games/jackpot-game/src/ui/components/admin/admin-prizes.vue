<template>
  <div class="admin-section">
    <h2>景品管理</h2>
    <form class="admin-form" @submit.prevent="addPrize">
      <input v-model="prizeName" type="text" placeholder="景品名" class="admin-input" />
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
      <button class="admin-btn" @click="saveEdit">保存</button>
      <button class="admin-btn ml-2" @click="cancelEdit">キャンセル</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { PrizeService } from '../../../model/applications/prize-service';

const prizeService = new PrizeService();
const prizes = ref<any[]>([]);
const fetchPrizes = async () => {
  prizes.value = await prizeService.fetchPrizes();
};
const prizeName = ref('');
const prizeRank = ref('高');
const addPrize = () => {
  // TODO: API経由で追加する実装に変更
  if (!prizeName.value) return;
  prizes.value.push({ name: prizeName.value, rank: prizeRank.value } as any);
  prizeName.value = '';
  prizeRank.value = '高';
};
const editIdx = ref<number|null>(null);
const editName = ref('');
const editRank = ref('高');
const editPrize = (idx: number) => {
  editIdx.value = idx;
  editName.value = prizes.value[idx].name;
  editRank.value = prizes.value[idx].rank;
};
const saveEdit = () => {
  // TODO: API経由で編集する実装に変更
  if (editIdx.value === null) return;
  prizes.value[editIdx.value] = { name: editName.value, rank: editRank.value } as any;
  editIdx.value = null;
  editName.value = '';
  editRank.value = '高';
};
const cancelEdit = () => {
  editIdx.value = null;
  editName.value = '';
  editRank.value = '高';
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
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
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
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
</style>
