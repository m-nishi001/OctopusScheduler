<template>
    <HeaderActions show-backup :backup-busy="downloadingBackup" :sync-status="status" :sync-error="lastError"
        @backup="onDownloadBackup" @home="router.push({ name: 'home' })">
        <UiButton icon="external" size="sm" title="投影用の実行画面を新しいタブで開きます。ショートカットの結果はここに表示されます" @click="openExecute">実行画面を開く</UiButton>
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
import { useBackgroundSync } from '../../../composables/use-background-sync';
import { exportLocalBackup } from '../../../../control/backup/backup-util';

const router = useRouter();
const { status, lastError } = useBackgroundSync();

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
