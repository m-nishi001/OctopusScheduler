<template>
    <header class="admin-header">
        <h1 class="admin-title">設定画面</h1>
        <div class="admin-actions">
            <SyncStatusIndicator :status="status" :last-error="lastError" />
            <button class="backup-btn" @click="onDownloadBackup" :disabled="downloadingBackup">
                バックアップをダウンロード
            </button>
        </div>
    </header>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import SyncStatusIndicator from '../../../components/sync-status-indicator.vue';
import { useBackgroundSync } from '../../../composables/use-background-sync';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

const { status, lastError } = useBackgroundSync();

const downloadingBackup = ref(false);

async function onDownloadBackup() {
    downloadingBackup.value = true;
    try {
        await exportLocalBackup({ includeAssets: true });
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

.admin-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 16px;
}

.backup-btn {
    background: transparent;
    color: #cfd6dd;
    border: 1px solid #4a5158;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-weight: 600;
}

.backup-btn:hover {
    opacity: 0.9;
}

.backup-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>
