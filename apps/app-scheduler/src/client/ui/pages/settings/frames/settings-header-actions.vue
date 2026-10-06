<template>
    <HeaderActions show-backup :backup-busy="downloadingBackup" @backup="onDownloadBackup" @home="router.push({ name: 'home' })">
        <SyncStatusIndicator :status="status" :last-error="lastError" />
    </HeaderActions>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HeaderActions } from '@octopus/ui-kit';
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
