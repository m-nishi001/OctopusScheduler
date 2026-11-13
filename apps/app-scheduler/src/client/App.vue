<script setup lang="ts">
import { watch } from 'vue';
import HostAgentBadge from './ui/pages/session/components/host-agent-badge.vue';
import { useAuthSession } from './control/auth/auth-session';
import { startBackgroundSync, stopBackgroundSync } from './ui/composables/use-background-sync';

// 素材の同期(アップロードと取り込み)は、管理者としてログインしている間、どの画面でも動かす。
// 設定画面を離れても止まらない(ホストの画面や、素材を追加した直後に別の画面へ移っても、アップロードが続く)。
const { currentMember } = useAuthSession();
watch(
    () => currentMember.value?.isAdmin === true,
    (admin) => (admin ? startBackgroundSync() : stopBackgroundSync()),
    { immediate: true }
);
</script>

<template>
    <div>
        <router-view />
        <HostAgentBadge />
    </div>
</template>

<style scoped></style>
