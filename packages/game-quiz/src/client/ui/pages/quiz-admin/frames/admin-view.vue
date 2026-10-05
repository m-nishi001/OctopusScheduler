<template>
    <PageShell title="クイズ管理" :tabs="tabs" :active-key="activeKey" @select="router.push({ name: $event })">
        <template #actions>
            <SyncStatusIndicator :status="status" :last-error="lastError" />
            <router-link to="/home" class="home-button" aria-label="ホームへ戻る">ホーム</router-link>
        </template>
        <router-view />
    </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PageShell } from '@octopus/ui-kit';
import SyncStatusIndicator from '../../../components/sync-status-indicator.vue';
import { useBackgroundSync } from '../../../composables/use-background-sync';

const router = useRouter();
const route = useRoute();
const { status, lastError } = useBackgroundSync();

const tabs = [
    { key: 'quiz-admin-quizzes', label: 'クイズ一覧' },
    { key: 'quiz-admin-members', label: 'メンバー管理' },
];
const activeKey = computed(() => String(route.name ?? ''));
</script>

<style scoped>
.home-button {
    background: #ffffff;
    color: #2b3036;
    padding: 4px 12px;
    border-radius: 6px;
    text-decoration: none;
    font-weight: 600;
    font-size: 0.9rem;
}

.home-button:hover {
    opacity: 0.9;
}
</style>
