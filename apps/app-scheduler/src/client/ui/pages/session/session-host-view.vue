<template>
    <div class="host-view">
        <header class="host-view__header">
            <ConnectionBanner :phase="state.phase" :failure-count="state.failureCount" />
            <div class="host-view__tools">
                <UiButton size="sm" @click="router.push('/sessions')">セッション一覧</UiButton>
                <UiButton v-if="joined" size="sm" variant="ghost" @click="leave">ホストをやめる</UiButton>
            </div>
        </header>

        <main class="host-view__main">
            <template v-if="joined && state.session">
                <h1 class="host-view__title">
                    {{ state.session.name }}
                    <span v-if="state.session.mode === 'demo'" class="host-view__tag">デモ</span>
                </h1>
                <SessionQr :code="state.session.code" :repository="repo" />
                <p class="host-view__presence">
                    管理端末 {{ state.presence?.admins.length ?? 0 }} 台 ・ 参加者 {{ state.presence?.clientCount ?? 0 }} 人
                </p>
                <p class="host-view__hint" data-testid="prepare-status">{{ prepareText }}</p>
                <p class="host-view__hint">この画面は管理端末からの操作で切り替わります。</p>
            </template>

            <template v-else-if="state.phase === 'replaced' && state.session?.id === sessionId">
                <p class="host-view__error" role="alert" data-testid="replaced">
                    別の端末がこのセッションのホストを引き継ぎました。この端末は操作を受け付けません。
                </p>
                <UiButton variant="primary" :loading="joining" @click="join(true)">この端末をホストに戻す</UiButton>
            </template>

            <template v-else-if="errorMessage">
                <p class="host-view__error" role="alert">{{ errorMessage }}</p>
                <UiButton variant="primary" :loading="joining" @click="join(false)">もう一度接続する</UiButton>
            </template>

            <p v-else class="host-view__hint">ホストとして接続しています…</p>
        </main>

        <UiDialog v-model="takeoverOpen" title="ホストを引き継ぎますか?" size="sm" confirm-label="引き継ぐ" :loading="joining"
            @confirm="join(true)">
            <p>{{ takeoverMessage }}</p>
            <p>引き継ぐと、これまでのホスト端末はコマンドを受け取れなくなります。</p>
        </UiDialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { UiButton, UiDialog, useConfirm } from '@octopus/ui-kit';
import { HostAgent, SessionAdminRepository, parseHubErrorCode, useConnectionState } from '@octopus/session-hub';
import { useAuthSession } from '../../../control/auth/auth-session';
import { prepareHostData } from '../../../control/session/prepare-host-data';
import ConnectionBanner from './components/connection-banner.vue';
import SessionQr from './components/session-qr.vue';

const route = useRoute();
const router = useRouter();
const agent = container.resolve(HostAgent);
const repo = container.resolve(SessionAdminRepository);
const state = useConnectionState(agent.connection);
const { currentMember } = useAuthSession();
const { confirm } = useConfirm();

const sessionId = computed(() => String(route.params.id ?? ''));
const joining = ref(false);
const errorMessage = ref('');
const takeoverOpen = ref(false);
const takeoverMessage = ref('');
const prepareState = ref<'idle' | 'running' | 'done' | 'failed'>('idle');
const prepareErrors = ref<string[]>([]);
const prepareText = computed(() => {
    if (prepareState.value === 'running') return 'ゲームのデータを取り込んでいます…(完了するまで本番画面を開かないでください)';
    if (prepareState.value === 'done') return 'ゲームのデータの準備ができました。';
    if (prepareState.value === 'failed') return `一部のデータを取り込めませんでした(${prepareErrors.value.join(' / ')})。管理画面で設定を同期してから再度開いてください。`;
    return '';
});

async function prepare() {
    prepareState.value = 'running';
    const result = await prepareHostData();
    prepareErrors.value = result.errors;
    prepareState.value = result.ok ? 'done' : 'failed';
}

const joined = computed(
    () => state.value.role === 'host' && state.value.session?.id === sessionId.value && state.value.phase !== 'idle' && state.value.phase !== 'ended' && state.value.phase !== 'unauthorized' && state.value.phase !== 'replaced',
);

function deviceLabel(): string {
    const who = currentMember.value?.name ?? '管理者';
    return `${who}のホスト端末`;
}

async function join(takeover: boolean) {
    if (joining.value) return;
    joining.value = true;
    errorMessage.value = '';
    try {
        // 別のセッションのホストとして接続中なら、切り替える前に確認する。
        const current = state.value.session;
        if (agent.active && current && current.id !== sessionId.value) {
            const ok = await confirm({
                title: 'ホストの切り替え',
                message: `この端末は「${current.name}」のホストとして接続中です。このセッションに切り替えますか?`,
                confirmLabel: '切り替える',
            });
            if (!ok) {
                await router.replace(`/session/host/${current.id}`);
                return;
            }
            agent.connection.leave();
        }
        await agent.connection.joinOperator({ sessionId: sessionId.value, role: 'host', label: deviceLabel(), takeover });
        takeoverOpen.value = false;
        await agent.publishSlice('session', { path: route.fullPath });
        void prepare();
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (parseHubErrorCode(message) === 'HOST_ALREADY_CONNECTED') {
            takeoverMessage.value = message.replace(/^\[[A-Z_]+\]\s*/, '');
            takeoverOpen.value = true;
        } else {
            takeoverOpen.value = false;
            errorMessage.value = message.replace(/^\[[A-Z_]+\]\s*/, '');
        }
    } finally {
        joining.value = false;
    }
}

function leave() {
    agent.connection.leave();
    void router.push('/sessions');
}

onMounted(() => {
    // リロード後は、保存済みの入室情報から復帰済み(アプリ起動時に agent.restore)。同じセッションなら何もしない。
    if (joined.value) return;
    void join(false);
});
</script>

<style scoped>
.host-view {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
    box-sizing: border-box;
}

.host-view__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 4vw;
}

.host-view__tools { display: flex; gap: 8px; }

.host-view__main {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 16px 4vw 32px;
    text-align: center;
}

.host-view__title { margin: 0; font-size: clamp(1.4rem, 5vmin, 3rem); }
.host-view__tag { margin-left: 8px; padding: 2px 10px; border-radius: 999px; background: #ffb300; color: #000; font-size: 0.5em; vertical-align: middle; }
.host-view__presence { margin: 0; font-size: clamp(1rem, 3vmin, 1.6rem); }
.host-view__hint { margin: 0; opacity: 0.6; }
.host-view__error { color: #ff8a80; max-width: 40em; }
</style>
