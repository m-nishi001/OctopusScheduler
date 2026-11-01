<template>
    <PageShell title="クイズ管理" :tabs="tabs" :active-key="activeKey" @select="router.push({ name: $event })">
        <template #actions>
            <HeaderActions :sync-status="status" :sync-error="lastError" :sync-log="log" :sync-kind-labels="SYNC_KIND_LABELS" @home="router.push('/home')">
                <UiButton icon="help" size="sm" @click="helpOpen = true">ヘルプ</UiButton>
            </HeaderActions>
            <UiDialog v-model="helpOpen" title="クイズ管理の使い方" size="md">
                <ul class="quiz-help">
                    <li>「クイズ一覧」でクイズを作成・編集します。「プレビュー」で進行画面を確認できます。</li>
                    <li>「メンバー管理」で参加者を登録します(ログイン用のIDとパスワード・受付QRは「設定」→「メンバー」で発行します)。</li>
                    <li>本番は「イベントを開催・進行する」で会場の投影端末を「ホストとして開く」、管理端末で「操作する」を開き、操作画面からクイズを選んで進行します。「ポータルに公開」すると、受付QRまたはIDとパスワードでログインした参加者が公開中のイベントに自動で入り、そこで回答します。</li>
                    <li>クイズ進行中は、ホストの <kbd>Enter</kbd> または操作画面の「次へ」で次の画面(イントロ → エントリー → 出題 → 解答 → 結果)に進みます。</li>
                    <li>設定画面に戻るには「ホーム」から「設定」を選びます。</li>
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
import { SYNC_KIND_LABELS, useBackgroundSync } from '../../../composables/use-background-sync';

const router = useRouter();
const route = useRoute();
const { status, lastError, log } = useBackgroundSync();
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
