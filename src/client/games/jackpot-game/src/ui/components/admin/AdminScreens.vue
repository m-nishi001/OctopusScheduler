<template>
  <div class="admin-section">
    <h2>画面管理</h2>
    <form class="admin-form" @submit.prevent="addScreen">
      <input v-model="screenName" type="text" placeholder="画面名" class="admin-input" />
      <button type="submit" class="admin-btn">追加</button>
    </form>
    <ul class="admin-list">
      <li v-for="(screen, idx) in screens" :key="screen.id" class="admin-list-item">
        <span>{{ screen.screen }}</span>
        <button class="admin-btn ml-2" @click="editScreen(idx)">編集</button>
        <button class="admin-btn ml-2" @click="deleteScreen(idx)">削除</button>
      </li>
    </ul>
    <div v-if="editIdx !== null" class="admin-edit-box">
      <h3>画面編集</h3>
      <input v-model="editName" type="text" class="admin-input" />
      <button class="admin-btn" @click="saveEdit">保存</button>
      <button class="admin-btn ml-2" @click="cancelEdit">キャンセル</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import type { ScreenContent } from '/root/google_apps_script/octopus-scheduler/src/client/games/jackpot-game/src/model/domains/member/Member';
function uuid() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
const screens = ref<ScreenContent[]>([
  { id: uuid(), screen: 'サンプル画面', type: 'text', value: '' }
]);
const screenName = ref('');
const addScreen = () => {
  if (!screenName.value) return;
  screens.value.push({
    id: uuid(),
    screen: screenName.value,
    type: 'text',
    value: ''
  });
  screenName.value = '';
};
const editIdx = ref<number|null>(null);
const editName = ref('');
const editScreen = (idx: number) => {
  editIdx.value = idx;
  editName.value = screens.value[idx].screen;
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  screens.value[editIdx.value].screen = editName.value;
  editIdx.value = null;
  editName.value = '';
};
const cancelEdit = () => {
  editIdx.value = null;
  editName.value = '';
};
const deleteScreen = (idx: number) => {
  screens.value.splice(idx, 1);
};
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
