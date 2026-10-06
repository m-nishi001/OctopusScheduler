<template>
    <PageShell title="クイズ管理" :tabs="tabs" :active-key="activeKey" @select="router.push({ name: $event })">
        <template #actions>
            <HeaderActions :sync-status="status" :sync-error="lastError" @home="router.push('/home')" />
        </template>
        <router-view />
    </PageShell>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { HeaderActions, PageShell } from '@octopus/ui-kit';
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
