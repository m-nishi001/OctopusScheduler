<template>
  <header class="admin-header">
    <button type="button" class="sidebar-toggle" aria-label="メニューを開閉"
      @click="$emit('toggle-sidebar')">☰</button>
    <h1 class="admin-title">管理画面</h1>
    <div style="margin-left:auto;display:flex;gap:12px;align-items:center;">
      <SyncStatusIndicator :status="status" :last-error="lastError" />
      <button class="backup-btn" @click="onDownloadBackup" :disabled="downloadingBackup">
        バックアップをダウンロード
      </button>
      <router-link to="/jackpot-home" class="home-button" aria-label="ホームへ戻る">ホーム</router-link>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SyncStatusIndicator from '@ui/components/sync-status-indicator.vue';
import { useBackgroundSync } from '../../../composables/use-background-sync';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

defineEmits(['toggle-sidebar']);

const { status, lastError } = useBackgroundSync();

const downloadingBackup = ref(false);

async function onDownloadBackup() {
  downloadingBackup.value = true;
  try {
    await exportLocalBackup(true);
  } catch (e) {
    console.error('Failed to export local backup', e);
  } finally {
    downloadingBackup.value = false;
  }
}
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

.sidebar-toggle {
  display: none;
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  width: 36px;
  height: 36px;
  font-size: 1.1rem;
  cursor: pointer;
  margin-right: 12px;
  flex-shrink: 0;
}

@media (max-width: 860px) {
  .sidebar-toggle {
    display: block;
  }

  .admin-title {
    font-size: 1.1rem;
  }
}

.home-button {
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

.backup-btn {
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.06);
  padding: 6px 10px;
  border-radius: 6px;
  font-weight: 700;
  cursor: pointer;
}

.backup-btn:hover {
  opacity: 0.95;
}

.backup-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
