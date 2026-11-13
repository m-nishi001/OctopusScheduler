<template>
    <HeaderActions show-backup :backup-busy="downloadingBackup" :sync-status="status" :sync-error="lastError" :sync-log="log" :sync-kind-labels="SYNC_KIND_LABELS"
        @backup="onDownloadBackup" @home="router.push({ name: 'home' })">
        <span v-if="pendingUpload !== null" class="pending-upload" :class="{ 'is-pending': pendingUpload > 0 }" data-testid="pending-upload"
            title="この端末にあって、まだサーバーにアップロードされていない素材の件数です。アップロード前に端末が使えなくなると、その素材は残りません">未アップロード {{ pendingUpload }} 件</span>
        <UiButton icon="external" size="sm" title="投影用の実行画面を新しいタブで開きます" @click="openExecute">実行画面を開く</UiButton>
        <UiButton icon="help" size="sm" @click="helpOpen = true">ヘルプ</UiButton>
        <UiButton v-if="isSignedIn" size="sm" @click="onSignOut">ログアウト</UiButton>
    </HeaderActions>
    <SettingsHelpDialog v-model="helpOpen" />
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { HeaderActions, UiButton } from '@octopus/ui-kit';
import SettingsHelpDialog from '../help/settings-help-dialog.vue';
import { useRouter } from 'vue-router';
import { useAuthSession } from '../../../../control/auth/auth-session';
import { SYNC_KIND_LABELS, useBackgroundSync } from '../../../composables/use-background-sync';
import { usePendingUpload } from '../../../composables/use-pending-upload';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

const router = useRouter();
const { status, lastError, log } = useBackgroundSync();
const { count: pendingUpload } = usePendingUpload();

const helpOpen = ref(false);

const { isSignedIn, signOut } = useAuthSession();

async function onSignOut() {
    await signOut();
    await router.push('/login');
}

function openExecute() {
    // hash history のため、href は #/execute 形式になる
    window.open(router.resolve('/execute').href, '_blank');
}

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
.pending-upload { font-size: 0.8rem; opacity: 0.75; white-space: nowrap; }
.pending-upload.is-pending { color: #ffb300; opacity: 1; font-weight: 700; }
</style>
