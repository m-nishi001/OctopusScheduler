<template>
    <HeaderActions show-backup :backup-busy="downloadingBackup" :sync-status="status" :sync-error="lastError"
        @backup="onDownloadBackup" @home="router.push({ name: 'home' })" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HeaderActions } from '@octopus/ui-kit';
import { useRouter } from 'vue-router';
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
