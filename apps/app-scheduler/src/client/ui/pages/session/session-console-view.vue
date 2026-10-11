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

                <h2 class="console__h2">参加者ポータルのイベント</h2>
                <div class="console__event" data-testid="event-panel">
                    <p class="console__sub" data-testid="event-state">
                        <template v-if="portalEvent">発生中: 「{{ portalEvent.title }}」 ・ ログイン中の参加者の画面に「イベント発生中」が出ています</template>
                        <template v-else>イベントは発生していません。開始すると、ログイン中の参加者の画面に「イベント発生中」が出ます。</template>
                    </p>
                    <form class="console__event-form" @submit.prevent="startEvent">
                        <input v-model="eventTitle" type="text" :maxlength="MAX_EVENT_TITLE_LENGTH" autocomplete="off"
                            placeholder="例: ジャックポット抽選" aria-label="イベント名" data-testid="event-title" />
                        <UiButton type="submit" variant="primary" :disabled="busyEvent !== null || !canSend || !normalizeEventTitle(eventTitle)"
                            :loading="busyEvent === 'start'">
                            {{ portalEvent ? 'イベントを切り替える' : 'イベントを開始' }}
                        </UiButton>
                        <UiButton v-if="portalEvent" variant="danger" :disabled="busyEvent !== null || !canSend" :loading="busyEvent === 'end'"
                            @click="endEvent">
                            イベントを終了
                        </UiButton>
                    </form>

                    <div v-if="portalEvent" class="console__entry" data-testid="entry-panel">
                        <p class="console__sub" data-testid="entry-state">
                            <template v-if="!portalEvent.entry">エントリー受付は始まっていません。開始すると、参加者の画面に「エントリー」ボタンが出ます。</template>
                            <template v-else-if="portalEvent.entry.open">エントリー受付中 ・ <strong data-testid="entry-count">{{ entryRoster.count.value }}</strong> 人</template>
                            <template v-else>エントリー受付は終了 ・ <strong data-testid="entry-count">{{ entryRoster.count.value }}</strong> 人（再開すると、途中から来た人も受け付けられます）</template>
                        </p>
                        <div class="console__presets">
                            <UiButton v-if="!portalEvent.entry?.open" variant="primary" :disabled="busyEntry !== null || !canSend"
                                :loading="busyEntry === 'openEntry'" @click="sendEntry('openEntry')">
                                {{ portalEvent.entry ? 'エントリー受付を再開' : 'エントリー受付を開始' }}
                            </UiButton>
                            <UiButton v-else variant="danger" :disabled="busyEntry !== null || !canSend" :loading="busyEntry === 'closeEntry'"
                                @click="sendEntry('closeEntry')">
                                エントリーを締め切る
                            </UiButton>
                            <UiButton :disabled="busyPath !== null || !canSend" :loading="busyPath === ENTRY_STAGE_PATH" @click="navigate(ENTRY_STAGE_PATH)">
                                会場の画面にエントリーを映す
                            </UiButton>
                        </div>
                        <ol v-if="entryRoster.answers.value.length > 0" class="console__entrants" data-testid="entrants">
                            <li v-for="(a, i) in recentEntrants" :key="a.deviceId">
                                <span class="console__seq">#{{ entryRoster.answers.value.length - i }}</span>
                                <span>{{ a.label }}</span>
                                <span class="console__sub">{{ entryTime(a.atMs) }}</span>
                            </li>
                        </ol>
                        <p v-if="entryRoster.error.value" class="console__sub is-warn" role="alert">エントリー一覧を取得できませんでした。人数が変わると自動で取り直します。</p>
                    </div>

                    <div v-if="portalEvent" class="console__pool" data-testid="pool-panel">
                        <p class="console__sub" data-testid="pool-state">
                            ジャックポットの抽選の対象:
                            <strong>{{ poolLabel }}</strong>
                        </p>
                        <p v-if="drawPool === 'entrants' && !portalEvent.entry" class="console__sub is-warn" data-testid="pool-hint">
                            エントリー受付を始めるまで、抽選の対象は0人です。
                        </p>
                        <div class="console__presets">
                            <UiButton :disabled="busyPool !== null || !canSend" :loading="busyPool !== null" @click="sendPool(drawPool === 'entrants' ? 'all' : 'entrants')">
                                {{ drawPool === 'entrants' ? '全メンバーに切り替える' : 'エントリーした人だけに切り替える' }}
                            </UiButton>
                        </div>
                    </div>
                </div>

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

                <h2 class="console__h2">クイズ</h2>
                <div class="console__quiz" data-testid="quiz-panel">
                    <label class="console__quiz-select">
                        クイズ
                        <select v-model="selectedQuizId" :disabled="quizzes.length === 0" data-testid="quiz-select">
                            <option v-if="quizzes.length === 0" value="">{{ quizLoading ? '読み込み中…' : 'クイズがありません' }}</option>
                            <option v-for="q in quizzes" :key="q.id" :value="q.id">{{ q.title || q.question }}</option>
                        </select>
                    </label>
                    <div class="console__presets">
                        <UiButton v-for="p in quizPages" :key="p.page" :disabled="busyPath !== null || !canSend || !selectedQuizId"
                            :loading="busyPath === quizPath(p.page)" @click="navigate(quizPath(p.page))">
                            {{ p.label }}
                        </UiButton>
                    </div>
                    <p class="console__sub" data-testid="quiz-state">
                        <template v-if="quizState">
                            {{ quizPageLabel }}<template v-if="quizState.phase === 'answering'"> ・ 回答受付中</template>
                            <template v-if="roundSummary"> ・ 回答 {{ roundSummary.answerCount }} 人</template>
                        </template>
                        <template v-else>クイズの画面を開くと、ここに進行状況が表示されます。</template>
                    </p>
                    <div class="console__presets">
                        <UiButton variant="primary" :disabled="busyQuiz !== null || !canSend" :loading="busyQuiz === 'advance'" @click="sendQuiz('advance')">
                            ▶ 次へ(Enterキー相当)
                        </UiButton>
                        <UiButton variant="danger" :disabled="busyQuiz !== null || !canSend || quizState?.phase !== 'answering'"
                            :loading="busyQuiz === 'closeAnswers'" @click="sendQuiz('closeAnswers')">
                            ⏹ 受付を今すぐ締め切る
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
import { container } from 'tsyringe';
import { GetAllQuizzesUseCase, QuizSyncService } from '@octopus/game-quiz';
import { PageShell, UiButton, toast } from '@octopus/ui-kit';
import {
    MAX_EVENT_TITLE_LENGTH,
    PORTAL_EVENT_CLOSE_ENTRY,
    PORTAL_EVENT_END,
    PORTAL_EVENT_NS,
    PORTAL_EVENT_OPEN_ENTRY,
    PORTAL_EVENT_SET_POOL,
    PORTAL_EVENT_START,
    createSessionConnection,
    lobbyPath,
    normalizeEventTitle,
    parseHubErrorCode,
    readPortalEvent,
    useRoundAnswers,
    useSessionConnection,
} from '@octopus/session-hub';
import type { DrawPool } from '@octopus/session-hub';
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
const busyQuiz = ref<'advance' | 'closeAnswers' | null>(null);
const busyEvent = ref<'start' | 'end' | null>(null);
const busyEntry = ref<'openEntry' | 'closeEntry' | null>(null);
const busyPool = ref<DrawPool | null>(null);
const eventTitle = ref('');
const quizzes = ref<Array<{ id: string; title: string; question: string }>>([]);
const quizLoading = ref(false);
const selectedQuizId = ref('');
const nowMs = ref(Date.now());

const isDemo = computed(() => state.value.session?.mode === 'demo');
const q = (path: string) => (isDemo.value ? `${path}?demo=1` : path);

/** 会場の画面に映すエントリー受付（バブル）。ホストの許可リスト(isAllowedHostPath)にある画面。 */
const ENTRY_STAGE_PATH = '/event-entry';

const presets = computed(() => [
    { label: 'ロビー(QR表示)', path: lobbyPath(sessionId.value) },
    { label: 'エントリー受付(バブル)', path: ENTRY_STAGE_PATH },
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
interface QuizState {
    page: string;
    phase: string;
}
const quizState = computed(() => (state.value.roomState?.data?.quiz as QuizState | undefined) ?? null);
const roundSummary = computed(() => state.value.round);
const QUIZ_PAGE_LABELS: Record<string, string> = { intro: 'イントロ', qr: 'QR表示', play: '出題中', answer: '正解発表', result: '結果発表' };
const quizPageLabel = computed(() => QUIZ_PAGE_LABELS[quizState.value?.page ?? ''] ?? '');
const quizPages = [
    { page: 'intro', label: 'イントロ' },
    { page: 'qr', label: 'QR' },
    { page: 'play', label: '出題' },
    { page: 'answer', label: '正解' },
    { page: 'result', label: '結果' },
];
const quizPath = (page: string): string => q(`/quiz/${selectedQuizId.value}/${page}`);
const portalEvent = computed(() => readPortalEvent(state.value.roomState?.data));
// エントリー済みの一覧（人数が変わったときだけ取り直す。定期的な問い合わせはしない）
const entryKey = computed(() => portalEvent.value?.entry?.key ?? null);
const entryRoster = useRoundAnswers(connection, state, entryKey);
/** ジャックポットの抽選の対象。指定が無いイベントは全メンバー。 */
const drawPool = computed<DrawPool>(() => portalEvent.value?.pool ?? 'all');
const poolLabel = computed(() => (drawPool.value === 'entrants' ? `エントリーした人だけ(${entryRoster.count.value}人)` : '全メンバー'));
/** 新しい順に最大50人。全員を並べると長くなるので、人数は別に出す。 */
const recentEntrants = computed(() => [...entryRoster.answers.value].reverse().slice(0, 50));
const entryTime = (atMs: number): string => new Date(atMs).toLocaleTimeString('ja-JP', { hour12: false });
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

/** 参加者ポータルのイベントを開始(または切り替え)/終了する。ホストが公開し、参加者の画面に反映される。 */
async function sendEvent(type: 'start' | 'end') {
    if (busyEvent.value !== null) return;
    const title = normalizeEventTitle(eventTitle.value);
    if (type === 'start' && !title) return;
    busyEvent.value = type;
    try {
        await connection.issue(PORTAL_EVENT_NS, type === 'start' ? PORTAL_EVENT_START : PORTAL_EVENT_END, type === 'start' ? { title } : undefined);
        if (type === 'start') eventTitle.value = '';
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(parseHubErrorCode(message) ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `送信できませんでした。通信状況を確認してください(${message})`);
    } finally {
        busyEvent.value = null;
    }
}

/** エントリー受付の開始/再開/締切。ホストが回答ラウンドを操作し、参加者の画面に反映される。 */
async function sendEntry(type: 'openEntry' | 'closeEntry') {
    if (busyEntry.value !== null) return;
    busyEntry.value = type;
    try {
        await connection.issue(PORTAL_EVENT_NS, type === 'openEntry' ? PORTAL_EVENT_OPEN_ENTRY : PORTAL_EVENT_CLOSE_ENTRY);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(parseHubErrorCode(message) ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `送信できませんでした。通信状況を確認してください(${message})`);
    } finally {
        busyEntry.value = null;
    }
}

/** 抽選の対象の切り替え（全メンバー / エントリーした人だけ）。ホストが公開し、抽選にも反映される。 */
async function sendPool(mode: DrawPool) {
    if (busyPool.value !== null) return;
    busyPool.value = mode;
    try {
        await connection.issue(PORTAL_EVENT_NS, PORTAL_EVENT_SET_POOL, { mode });
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(parseHubErrorCode(message) ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `送信できませんでした。通信状況を確認してください(${message})`);
    } finally {
        busyPool.value = null;
    }
}

const startEvent = () => sendEvent('start');
const endEvent = () => sendEvent('end');

async function sendQuiz(type: 'advance' | 'closeAnswers') {
    if (busyQuiz.value !== null) return;
    busyQuiz.value = type;
    try {
        await connection.issue('quiz', type);
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(parseHubErrorCode(message) ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `送信できませんでした。通信状況を確認してください(${message})`);
    } finally {
        busyQuiz.value = null;
    }
}

/** クイズの一覧。この端末に無ければ Drive から取り込んで読み直す(スマホの管理端末は初回は空のため)。 */
async function loadQuizzes() {
    quizLoading.value = true;
    try {
        const list = container.resolve(GetAllQuizzesUseCase);
        let all = await list.execute();
        if (all.length === 0) {
            await container.resolve(QuizSyncService).syncAll();
            all = await list.execute();
        }
        quizzes.value = all.map((x) => ({ id: x.id, title: x.title, question: x.question }));
        if (!selectedQuizId.value && quizzes.value.length > 0) selectedQuizId.value = quizzes.value[0].id;
    } catch {
        quizzes.value = [];
    } finally {
        quizLoading.value = false;
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
    void loadQuizzes();
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
.console__quiz { display: flex; flex-direction: column; gap: 8px; }
.console__event { display: flex; flex-direction: column; gap: 8px; }
.console__event-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.console__entry { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
.console__pool { display: flex; flex-direction: column; gap: 6px; padding-top: 4px; }
.console__entrants { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
.console__entrants li { display: flex; gap: 12px; align-items: baseline; }
.console__event-form input { flex: 1 1 14em; max-width: 28em; font: inherit; padding: 8px; border-radius: 6px; background: var(--ui-surface, #2b3036); color: inherit; border: 1px solid var(--ui-border, #3a4048); }
.console__quiz-select { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; max-width: 28em; }
.console__quiz-select select { font: inherit; padding: 8px; border-radius: 6px; background: var(--ui-surface, #2b3036); color: inherit; border: 1px solid var(--ui-border, #3a4048); }
.console__log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.console__log li { display: flex; gap: 12px; align-items: baseline; }
.console__seq { font-variant-numeric: tabular-nums; opacity: 0.6; }
.console__ended { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
code { background: rgba(255, 255, 255, 0.1); padding: 1px 6px; border-radius: 4px; }
</style>
