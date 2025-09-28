<template>
  <div class="admin-section">
    <h2>画面管理</h2>
    <form class="admin-form" @submit.prevent="addScreen">
      <input v-model="screenName" type="text" placeholder="画面名" class="admin-input" />
      <select v-model="screenType" class="admin-input">
        <option value="home">ホーム</option>
        <option value="opening">オープニング</option>
        <option value="description">説明</option>
        <option value="demo">デモ</option>
        <option value="main">本抽選</option>
        <option value="result">結果</option>
        <option value="admin">管理</option>
      </select>
      <input v-model="bgmAssetIdInput" type="text" placeholder="BGM Asset ID" class="admin-input" />
      <input v-model="seAssetIdsInput" type="text" placeholder="SE Asset IDs（カンマ区切り）" class="admin-input" />
      <input v-model="backgroundStyleInput" type="text" placeholder="背景スタイル" class="admin-input" />
      <input v-model="animationTypeInput" type="text" placeholder="アニメーションタイプ" class="admin-input" />
      <input v-model="animationDurationInput" type="number" placeholder="アニメーション時間(ms)" class="admin-input" />
      <button type="submit" class="admin-btn">追加</button>
    </form>
  <ul class="admin-list">
      <li v-for="(screen, idx) in screens" :key="screen.id" class="admin-list-item">
  <span>{{ screen.content }}</span>
  <span>種別: {{ screen.type }}</span>
  <span v-if="screen.bgmAssetId">BGM: {{ screen.bgmAssetId }}</span>
  <span v-if="screen.seAssetIds && screen.seAssetIds.length">SE: {{ screen.seAssetIds.join(', ') }}</span>
  <span v-if="screen.backgroundStyle">背景: {{ screen.backgroundStyle }}</span>
  <span v-if="screen.animation">アニメーション: {{ screen.animation.type }} ({{ screen.animation.duration }}ms)</span>
        <button class="admin-btn ml-2" @click="editScreen(idx)">編集</button>
        <button class="admin-btn ml-2" @click="deleteScreen(idx)">削除</button>
      </li>
    </ul>
  <div v-if="editIdx !== null" class="admin-edit-box">
  <button class="admin-btn mt-4" @click="saveScreens">保存</button>
      <h3>画面編集</h3>
      <input v-model="editName" type="text" class="admin-input" />
      <select v-model="editType" class="admin-input">
        <option value="home">ホーム</option>
        <option value="opening">オープニング</option>
        <option value="description">説明</option>
        <option value="demo">デモ</option>
        <option value="main">本抽選</option>
        <option value="result">結果</option>
        <option value="admin">管理</option>
      </select>
      <input v-model="editBgmAssetIdInput" type="text" placeholder="BGM Asset ID" class="admin-input" />
      <input v-model="editSeAssetIdsInput" type="text" placeholder="SE Asset IDs（カンマ区切り）" class="admin-input" />
      <input v-model="editBackgroundStyleInput" type="text" placeholder="背景スタイル" class="admin-input" />
      <input v-model="editAnimationTypeInput" type="text" placeholder="アニメーションタイプ" class="admin-input" />
      <input v-model="editAnimationDurationInput" type="number" placeholder="アニメーション時間(ms)" class="admin-input" />
      <button class="admin-btn" @click="saveEdit">保存</button>
      <button class="admin-btn ml-2" @click="cancelEdit">キャンセル</button>
    </div>
  </div>
</template>
<script setup lang="ts">
// ...existing code...
import { ScreenConfigRepository } from '../../../model/infrastructures/repository/screen-config-repository';
const screenConfigRepository = new ScreenConfigRepository();
const fetchScreens = async () => {
  // 必要な画面種別一覧
  const types = ['home','opening','description','demo','main','result','admin'];
  await screenConfigRepository.loadAllFromStorage(types);
  screens.value = types.map(type => screenConfigRepository.fetchScreenConfig(type)).filter(Boolean);
};
fetchScreens();
const saveScreens = async () => {
  await screenConfigRepository.saveScreenConfigs(screens.value);
};
import { ref } from 'vue';
function uuid() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}
const screens = ref<any[]>([]);
const screenName = ref('');
const screenType = ref('home');
const bgmAssetIdInput = ref('');
const seAssetIdsInput = ref('');
const backgroundStyleInput = ref('');
const animationTypeInput = ref('');
const animationDurationInput = ref(0);
const addScreen = () => {
  if (!screenName.value) return;
  screens.value.push({
    id: uuid(),
    content: screenName.value,
    type: screenType.value,
    bgmAssetId: bgmAssetIdInput.value,
    seAssetIds: seAssetIdsInput.value ? seAssetIdsInput.value.split(',').map(a => a.trim()) : [],
    backgroundStyle: backgroundStyleInput.value,
    animation: animationTypeInput.value ? { type: animationTypeInput.value, duration: animationDurationInput.value } : undefined
  });
  screenName.value = '';
  screenType.value = 'home';
  bgmAssetIdInput.value = '';
  seAssetIdsInput.value = '';
  backgroundStyleInput.value = '';
  animationTypeInput.value = '';
  animationDurationInput.value = 0;
};
const editIdx = ref<number|null>(null);
const editName = ref('');
const editType = ref('home');
const editBgmAssetIdInput = ref('');
const editSeAssetIdsInput = ref('');
const editBackgroundStyleInput = ref('');
const editAnimationTypeInput = ref('');
const editAnimationDurationInput = ref(0);
const editScreen = (idx: number) => {
  editIdx.value = idx;
  const screen = screens.value[idx];
  editName.value = screen.content ?? '';
  editType.value = screen.type ?? 'home';
  editBgmAssetIdInput.value = screen.bgmAssetId || '';
  editSeAssetIdsInput.value = screen.seAssetIds ? screen.seAssetIds.join(', ') : '';
  editBackgroundStyleInput.value = screen.backgroundStyle || '';
  editAnimationTypeInput.value = screen.animation?.type || '';
  editAnimationDurationInput.value = screen.animation?.duration || 0;
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  screens.value[editIdx.value] = {
    ...screens.value[editIdx.value],
    content: editName.value,
    type: editType.value,
    bgmAssetId: editBgmAssetIdInput.value,
    seAssetIds: editSeAssetIdsInput.value ? editSeAssetIdsInput.value.split(',').map(a => a.trim()) : [],
    backgroundStyle: editBackgroundStyleInput.value,
    animation: editAnimationTypeInput.value ? { type: editAnimationTypeInput.value, duration: editAnimationDurationInput.value } : undefined
  };
  editIdx.value = null;
  editName.value = '';
  editType.value = 'home';
  editBgmAssetIdInput.value = '';
  editSeAssetIdsInput.value = '';
  editBackgroundStyleInput.value = '';
  editAnimationTypeInput.value = '';
  editAnimationDurationInput.value = 0;
};
const cancelEdit = () => {
  editIdx.value = null;
  editName.value = '';
  editType.value = 'home';
  editBgmAssetIdInput.value = '';
  editSeAssetIdsInput.value = '';
  editBackgroundStyleInput.value = '';
  editAnimationTypeInput.value = '';
  editAnimationDurationInput.value = 0;
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
