<template>
    <PageShell :title="state.session ? `操作: ${state.session.name}` : '操作'">
        <template #actions>
            <ConnectionBanner :phase="state.phase" :failure-count="state.failureCount" />
            <UiButton @click="router.push('/sessions')">セッション一覧</UiButton>
        </template>

        <section class="console">
            <p v-if="errorMessage" class="console__error" role="alert">{{ errorMessage }}</p>

            <div v-if="state.phase === 'unauthorized' || state.phase === 'ended'" class="console__ended">
                <p>{{ state.phase === 'ended' ? 'このセッションは終了しました。' : '認証が切れました。' }}</p>
                <UiButton v-if="state.phase === 'unauthorized'" variant="primary" :loading="joining" @click="join">入り直す</UiButton>
            </div>

            <template v-if="state.session && state.phase !== 'ended'">
                <div class="console__cards">
                    <article class="console__card" :class="{ 'is-offline': !host.online }" data-testid="host-card">
                        <h2>ホスト</h2>
                        <p class="console__big">{{ host.text }}</p>
                        <p v-if="hostPath" class="console__sub">表示中: <code>{{ hostPath }}</code></p>
                        <p v-if="pending > 0" class="console__sub is-warn">未適用のコマンド {{ pending }} 件</p>
                    </article>
                    <article class="console__card" data-testid="people-card">
                        <h2>接続</h2>
                        <p class="console__big">参加者 {{ state.presence?.clientCount ?? 0 }} 人</p>
                        <p class="console__sub">管理端末 {{ state.presence?.admins.length ?? 0 }} 台</p>
                        <p class="console__sub">参加コード <code>{{ state.session.code }}</code></p>
                    </article>
                </div>

                <p v-if="!host.online" class="console__warn" role="alert" data-testid="host-warning">
                    ホストが不在です。送ったコマンドは、ホストが戻っても約30秒を過ぎていると適用されません。
                </p>

                <h2 class="console__h2">ホストの画面を切り替える</h2>
                <div class="console__presets" data-testid="presets">
                    <UiButton v-for="p in presets" :key="p.path" :disabled="busyPath !== null || !canSend" :loading="busyPath === p.path"
                        @click="navigate(p.path)">
                        {{ p.label }}
                    </UiButton>
                </div>

                <h2 class="console__h2">ジャックポット</h2>
                <div class="console__jackpot" data-testid="jackpot-panel">
                    <p class="console__sub" data-testid="jackpot-state">
                        <template v-if="jackpot">
                            {{ phaseLabel }} ・ 当選者: {{ jackpot.member ?? '—' }} ・ 賞品: {{ jackpot.prize ?? '—' }}
                        </template>
                        <template v-else>本抽選の画面を開くと、ここに進行状況が表示されます。</template>
                    </p>
                    <div class="console__presets">
                        <UiButton variant="primary" :disabled="busyJackpot !== null || !canSend" :loading="busyJackpot === 'advance'"
                            @click="sendJackpot('advance')">
                            ▶ 次へ(Enterキー相当)
                        </UiButton>
                        <UiButton :disabled="busyJackpot !== null || !canSend || !jackpot?.canStop" :loading="busyJackpot === 'stopRoulette'"
                            @click="sendJackpot('stopRoulette')">
                            ⏹ 止める
                        </UiButton>
                    </div>
                </div>

                <h2 class="console__h2">操作ログ</h2>
                <ol class="console__log" data-testid="log">
                    <li v-for="c in log" :key="c.seq">
                        <span class="console__seq">#{{ c.seq }}</span>
                        <span>{{ c.game }}.{{ c.type }}</span>
                        <span class="console__sub">{{ c.issuerRole === 'client' ? '参加者' : '管理' }}</span>
                    </li>
                    <li v-if="log.length === 0" class="console__sub">まだ操作はありません</li>
                </ol>
            </template>

            <p v-else-if="state.phase === 'joining' || state.phase === 'idle'" class="console__sub">接続しています…</p>
        </section>
    </PageShell>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { PageShell, UiButton, toast } from '@octopus/ui-kit';
import { createSessionConnection, lobbyPath, parseHubErrorCode, useSessionConnection } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import { useAuthSession } from '../../../control/auth/auth-session';
import ConnectionBanner from './components/connection-banner.vue';
import { describeHostPresence } from './connection-labels';

const props = defineProps<{ connection?: SessionConnection }>();

const route = useRoute();
const router = useRouter();
const { currentMember } = useAuthSession();

// 管理端末の接続はこの画面の寿命と一緒(画面を閉じたら切断。入室情報は残るのでリロードで復帰できる)。
const { state, connection } = useSessionConnection(props.connection ?? createSessionConnection());

const sessionId = computed(() => String(route.params.id ?? ''));
const joining = ref(false);
const errorMessage = ref('');
const busyPath = ref<string | null>(null);
const busyJackpot = ref<'advance' | 'stopRoulette' | null>(null);
const nowMs = ref(Date.now());

const isDemo = computed(() => state.value.session?.mode === 'demo');
const q = (path: string) => (isDemo.value ? `${path}?demo=1` : path);

const presets = computed(() => [
    { label: 'ロビー(QR表示)', path: lobbyPath(sessionId.value) },
    { label: 'ジャックポット: オープニング', path: q('/jackpot-opening') },
    { label: 'ジャックポット: 説明', path: q('/jackpot-description') },
    { label: 'ジャックポット: 抽選', path: q('/jackpot-draw') },
    { label: 'ジャックポット: 結果', path: q('/jackpot-result') },
    { label: 'ジャックポット: エンディング', path: q('/jackpot-ending') },
]);

const serverNow = computed(() => nowMs.value + state.value.serverOffsetMs);
const host = computed(() => describeHostPresence(state.value.presence?.host?.seenAtMs ?? null, serverNow.value));
const pending = computed(() => Math.max(0, state.value.headSeq - (state.value.presence?.host?.ackSeq ?? 0)));
const hostPath = computed(() => {
    const session = state.value.roomState?.data?.session as { path?: string } | undefined;
    return session?.path ?? '';
});
interface JackpotState {
    phase: string;
    canStop: boolean;
    member: string | null;
    prize: string | null;
}
const jackpot = computed(() => (state.value.roomState?.data?.jackpot as JackpotState | undefined) ?? null);
const phaseLabel = computed(() => {
    const phase = jackpot.value?.phase;
    return phase === 'member' ? 'メンバー抽選' : phase === 'prize' ? '賞品抽選' : '待機中';
});
const log = computed(() => [...state.value.recentCommands].reverse().slice(0, 15));
const canSend = computed(() => state.value.phase === 'connected' || state.value.phase === 'reconnecting');

function label(): string {
    return `${currentMember.value?.name ?? '管理者'}の管理端末`;
}

async function join() {
    if (joining.value) return;
    joining.value = true;
    errorMessage.value = '';
    try {
        await connection.joinOperator({ sessionId: sessionId.value, role: 'admin', label: label() });
    } catch (e) {
        errorMessage.value = (e instanceof Error ? e.message : String(e)).replace(/^\[[A-Z_]+\]\s*/, '');
    } finally {
        joining.value = false;
    }
}

async function navigate(path: string) {
    if (busyPath.value !== null) return;
    busyPath.value = path;
    try {
        await connection.issue('session', 'navigate', { path });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const code = parseHubErrorCode(message);
        toast.error(code ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `送信できませんでした。通信状況を確認してください(${message})`);
    } finally {
        busyPath.value = null;
    }
}

async function sendJackpot(type: 'advance' | 'stopRoulette') {
    if (busyJackpot.value !== null) return;
    busyJackpot.value = type;
    try {
        await connection.issue('jackpot', type);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(parseHubErrorCode(message) ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `送信できませんでした。通信状況を確認してください(${message})`);
    } finally {
        busyJackpot.value = null;
    }
}

let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    clock = setInterval(() => {
        nowMs.value = Date.now();
    }, 1000);
    // リロード後は保存済みの入室情報から復帰(同じセッションのときだけ)。無ければ入室する。
    void join();
});
onUnmounted(() => {
    if (clock) clearInterval(clock);
});
</script>

<style scoped>
.console { display: flex; flex-direction: column; gap: var(--ui-space-3, 12px); padding: var(--ui-space-4, 16px) 4vw 32px; }
.console__cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px; }
.console__card { background: var(--ui-surface, #2b3036); border-radius: 10px; padding: 12px 16px; }
.console__card.is-offline { outline: 2px solid #ffb300; }
.console__card h2 { margin: 0 0 6px; font-size: 0.9rem; opacity: 0.7; }
.console__big { margin: 0; font-size: 1.3rem; font-weight: 700; }
.console__sub { margin: 4px 0 0; font-size: 0.85rem; opacity: 0.75; }
.console__sub.is-warn { color: #ffb300; opacity: 1; }
.console__warn { margin: 0; padding: 8px 12px; border-radius: 8px; background: rgba(255, 179, 0, 0.15); color: #ffd54f; }
.console__error { margin: 0; color: #ff8a80; }
.console__h2 { margin: 8px 0 0; font-size: 1rem; }
.console__presets { display: flex; flex-wrap: wrap; gap: 8px; }
.console__log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.console__log li { display: flex; gap: 12px; align-items: baseline; }
.console__seq { font-variant-numeric: tabular-nums; opacity: 0.6; }
.console__ended { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
code { background: rgba(255, 255, 255, 0.1); padding: 1px 6px; border-radius: 4px; }
</style>
