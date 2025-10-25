<template>
  <header class="admin-header">
    <h1 class="admin-title">管理画面</h1>
    <div style="margin-left:auto;display:flex;gap:8px;align-items:center;">
      <button class="sync-all-button" @click="showSync = true" title="一括同期">同期</button>
      <router-link to="/jackpot-home" class="home-button" aria-label="ホームへ戻る">ホーム</router-link>
    </div>
    <SyncDialog v-if="showSync" @close="closeSync" />
  </header>
</template>

<script setup lang="ts">
// ヘッダーのロジック（必要に応じて拡張）
import { ref } from 'vue';
import SyncDialog from '../../../components/sync-dialog.vue';

const showSync = ref(false);

const closeSync = () => {
  showSync.value = false;
};
</script>

<style scoped>
.admin-header {
  background: #2b3036;
  color: #ffffff;
  padding: 8px 28px;
  height: 48px;
  display: flex;
  align-items: center;
  box-shadow: none;
}

.admin-title {
  font-size: 1.3rem;
  font-weight: bold;
  margin: 0;
}

.home-button {
  margin-left: auto;
  /* 右寄せ */
  background: #ffffff;
  color: #2b3036;
  padding: 6px 12px;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
}

.home-button:hover {
  opacity: 0.9;
}

.sync-all-button {
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 6px 10px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.sync-all-button:hover {
  opacity: 0.95;
}
</style>
