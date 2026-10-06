<template>
    <PageShell title="クイズ管理" :tabs="tabs" :active-key="activeKey" @select="router.push({ name: $event })">
        <template #actions>
            <HeaderActions :sync-status="status" :sync-error="lastError" @home="router.push('/home')">
                <UiButton icon="help" size="sm" @click="helpOpen = true">ヘルプ</UiButton>
            </HeaderActions>
            <UiDialog v-model="helpOpen" title="クイズ管理の使い方" size="md">
                <ul class="quiz-help">
                    <li>「クイズ一覧」でクイズを作成・編集します。「プレビュー」で進行画面を確認できます。</li>
                    <li>「メンバー管理」で参加者を登録します。</li>
                    <li>本番は、設定画面の「画面遷移」イベントに <code>/quiz/クイズID/intro</code> を指定し、ショートカットで実行画面を切り替えます。</li>
                    <li>クイズ進行中は <kbd>Enter</kbd> で次の画面(イントロ → QR → 出題 → 解答 → 結果)に進みます。</li>
                    <li>設定画面に戻るには「ホーム」から「設定画面」を選びます。</li>
                </ul>
                <template #footer><UiButton variant="primary" @click="helpOpen = false">閉じる</UiButton></template>
            </UiDialog>
        </template>
        <router-view />
    </PageShell>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { HeaderActions, PageShell, UiButton, UiDialog } from '@octopus/ui-kit';
import { useBackgroundSync } from '../../../composables/use-background-sync';

const router = useRouter();
const route = useRoute();
const { status, lastError } = useBackgroundSync();
const helpOpen = ref(false);

const tabs = [
    { key: 'quiz-admin-quizzes', label: 'クイズ一覧' },
    { key: 'quiz-admin-members', label: 'メンバー管理' },
];
const activeKey = computed(() => String(route.name ?? ''));
</script>

<style scoped>
.quiz-help { margin: 0; padding-left: 1.4em; line-height: 1.7; }
</style>
