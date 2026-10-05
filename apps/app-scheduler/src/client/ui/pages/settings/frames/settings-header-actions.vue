<template>
    <SyncStatusIndicator :status="status" :last-error="lastError" />
    <button type="button" class="header-btn" :disabled="downloadingBackup" @click="onDownloadBackup">
        バックアップ
    </button>
    <button type="button" class="header-btn" @click="router.push({ name: 'home' })">ホームへ</button>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import SyncStatusIndicator from '../../../components/sync-status-indicator.vue';
import { useBackgroundSync } from '../../../composables/use-background-sync';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

const router = useRouter();
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
.header-btn {
    background: transparent;
    color: #cfd6dd;
    border: 1px solid #4a5158;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 0.9rem;
    font-weight: 600;
    cursor: pointer;
}

.header-btn:hover {
    opacity: 0.9;
}

.header-btn:disabled {
    opacity: 0.5;
    cursor: default;
}
</style>
