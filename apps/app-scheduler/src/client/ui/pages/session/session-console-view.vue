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
                <!-- いま何が起きているか(1か所に集約) -->
                <article class="console__status" :class="{ 'is-offline': !host.online }" data-testid="status-card">
                    <p class="console__now" data-testid="now">{{ guidance.now }}</p>
                    <p class="console__sub" data-testid="host-card">
                        <span class="console__dot" :class="{ 'is-on': host.online }" aria-hidden="true"></span>
                        ホスト: {{ host.text }} ・ 参加者 {{ state.presence?.clientCount ?? 0 }} 人
                    </p>
                    <p class="console__sub" data-testid="event-state">
                        <template v-if="portalEvent">イベント「{{ portalEvent.title }}」を開催中</template>
                        <template v-else>イベントは開催していません(下の「始める」を押すと、自動で開催します)</template>
                    </p>
                </article>

                <p v-if="!host.online" class="console__warn" role="alert" data-testid="host-warning">
                    ホストが不在です。会場のPCで「ホストとして開く」を行ってください。送ったコマンドは、ホストが戻っても約30秒を過ぎていると適用されません。
                    <UiButton size="sm" data-testid="open-host-here" @click="router.push(lobbyPath(sessionId))">この端末をホストにする</UiButton>
                </p>

                <!-- 主ボタンは常に1つ。押すと何が起きるかを予告する -->
                <div v-if="guidance.main" class="console__main" data-testid="next-panel">
                    <UiButton variant="primary" class="console__main-button" :disabled="busyMain || !canSend" :loading="busyMain"
                        data-testid="next-button" @click="runMain">
                        {{ guidance.main.label }}
                        <kbd v-if="enterTriggers(guidance.main.action)" class="console__key" data-testid="next-key">Enter</kbd>
                    </UiButton>
                    <p class="console__hint" data-testid="next-hint">押すと: {{ guidance.main.hint }}</p>
                    <div v-if="guidance.back" class="console__back">
                        <UiButton class="console__back-button" :disabled="busyMain || !canSend" data-testid="back-button" @click="runBack">
                            ← {{ guidance.back.label }}
                            <kbd class="console__key" data-testid="back-key">Backspace</kbd>
                        </UiButton>
                        <p class="console__hint" data-testid="back-hint">押すと: {{ guidance.back.hint }}</p>
                    </div>
                </div>

                <!-- 始める: ワンクリックでイベント開催〜対象の画面まで -->
                <section class="console__start" data-testid="start-panel">
                    <h2 class="console__h2">{{ guidance.game ? '別のものを始める' : '始める' }}</h2>
                    <div class="console__start-grid">
                        <div class="console__start-card" data-testid="quiz-panel">
                            <label class="console__quiz-select">
                                クイズ
                                <select v-model="selectedQuizId" :disabled="quizzes.length === 0" data-testid="quiz-select">
                                    <option v-if="quizzes.length === 0" value="">{{ quizLoading ? '読み込み中…' : 'クイズがありません' }}</option>
                                    <option v-for="q in quizzes" :key="q.id" :value="q.id">{{ q.title || q.question }}</option>
                                </select>
                            </label>
                            <UiButton variant="primary" :disabled="busyStart !== null || !canSend || !selectedQuizId" :loading="busyStart === 'quiz'"
                                data-testid="start-quiz" @click="startQuiz">
                                このクイズを始める
                            </UiButton>
                        </div>
                        <div class="console__start-card" data-testid="jackpot-panel">
                            <p class="console__sub">ジャックポット抽選</p>
                            <UiButton variant="primary" :disabled="busyStart !== null || !canSend" :loading="busyStart === 'jackpot'"
                                data-testid="start-jackpot" @click="startJackpot">
                                ジャックポットを始める
                            </UiButton>
                        </div>
                        <div class="console__start-card" data-testid="entry-start-card">
                            <p class="console__sub">参加者のエントリー受付</p>
                            <UiButton variant="primary" :disabled="busyStart !== null || !canSend" :loading="busyStart === 'entry'"
                                data-testid="start-entry" @click="startEntry">
                                エントリー受付を始める
                            </UiButton>
                        </div>
                    </div>
                    <p class="console__sub" data-testid="quiz-state">
                        <template v-if="quizState">{{ quizPageLabel }}<template v-if="roundSummary"> ・ 回答 {{ roundSummary.answerCount }} 人</template></template>
                    </p>
                    <p class="console__sub" data-testid="jackpot-state">
                        <template v-if="jackpot">{{ phaseLabel }} ・ 当選者: {{ jackpot.member ?? '—' }} ・ 賞品: {{ jackpot.prize ?? '—' }}</template>
                    </p>
                </section>

                <!-- エントリー受付(イベント開催中だけ) -->
                <section v-if="portalEvent" class="console__entry" data-testid="entry-panel">
                    <h2 class="console__h2">エントリー受付</h2>
                    <p class="console__sub" data-testid="entry-state">
                        <template v-if="!portalEvent.entry">受付は始まっていません。</template>
                        <template v-else-if="portalEvent.entry.open">受付中 ・ <strong data-testid="entry-count">{{ entryRoster.count.value }}</strong> 人</template>
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
                    <div class="console__pool" data-testid="pool-panel">
                        <p class="console__sub" data-testid="pool-state">
                            ジャックポットの抽選の対象:
                            <strong>{{ poolLabel }}</strong>
                        </p>
                        <p v-if="drawPool === 'entrants' && !portalEvent.entry" class="console__sub is-warn" data-testid="pool-hint">
                            エントリー受付を始めるまで、抽選の対象は0人です。
                        </p>
                        <UiButton :disabled="busyPool !== null || !canSend" :loading="busyPool !== null" @click="sendPool(drawPool === 'entrants' ? 'auto' : 'entrants')">
                            {{ drawPool === 'entrants' ? '参加者全員(自動)に切り替える' : 'エントリーした人だけに切り替える' }}
                        </UiButton>
                    </div>
                </section>

                <div v-if="portalEvent" class="console__end">
                    <UiButton variant="danger" :disabled="busyEvent !== null || !canSend" :loading="busyEvent === 'end'" data-testid="end-event" @click="endEvent">
                        イベントを終了
                    </UiButton>
                </div>

                <!-- 普段は使わない操作 -->
                <details class="console__advanced" data-testid="advanced">
                    <summary>詳細な操作(画面の直接切り替え・ログ など)</summary>

                    <h3 class="console__h3">ホストの画面を直接切り替える</h3>
                    <div class="console__presets" data-testid="presets">
                        <UiButton v-for="p in presets" :key="p.path" :disabled="busyPath !== null || !canSend" :loading="busyPath === p.path"
                            @click="navigate(p.path)">
                            {{ p.label }}
                        </UiButton>
                    </div>

                    <h3 class="console__h3">クイズの画面を直接切り替える</h3>
                    <div class="console__presets">
                        <UiButton v-for="p in quizPages" :key="p.page" :disabled="busyPath !== null || !canSend || !selectedQuizId"
                            :loading="busyPath === quizPath(p.page)" @click="navigate(quizPath(p.page), p.page === 'entry' ? ensureQuizEvent : undefined)">
                            {{ p.label }}
                        </UiButton>
                    </div>

                    <h3 class="console__h3">イベント名を指定して開催する</h3>
                    <form class="console__event-form" @submit.prevent="startEvent">
                        <input v-model="eventTitle" type="text" :maxlength="MAX_EVENT_TITLE_LENGTH" autocomplete="off"
                            placeholder="例: 夏祭りスペシャル" aria-label="イベント名" data-testid="event-title" />
                        <UiButton type="submit" :disabled="busyEvent !== null || !canSend || !normalizeEventTitle(eventTitle)" :loading="busyEvent === 'start'">
                            {{ portalEvent ? 'イベントを切り替える' : 'イベントを開始' }}
                        </UiButton>
                    </form>

                    <h3 class="console__h3">接続の状況</h3>
                    <p v-if="hostPath" class="console__sub">ホストの表示中の画面: <code>{{ hostPath }}</code></p>
                    <p v-if="pending > 0" class="console__sub is-warn">未適用のコマンド {{ pending }} 件</p>
                    <p class="console__sub" data-testid="people-card">管理端末 {{ state.presence?.admins.length ?? 0 }} 台</p>

                    <h3 class="console__h3">操作ログ</h3>
                    <ol class="console__log" data-testid="log">
                        <li v-for="c in log" :key="c.seq">
                            <span class="console__seq">#{{ c.seq }}</span>
                            <span>{{ c.game }}.{{ c.type }}</span>
                            <span class="console__sub">{{ c.issuerRole === 'client' ? '参加者' : '管理' }}</span>
                        </li>
                        <li v-if="log.length === 0" class="console__sub">まだ操作はありません</li>
                    </ol>
                </details>
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
import { PageShell, UiButton, toast, useConfirm } from '@octopus/ui-kit';
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
    parseHubErrorCode, stripHubErrorCode,
    readJackpotState,
    readPortalEvent,
    useRoundAnswers,
    useSessionConnection,
} from '@octopus/session-hub';
import type { DrawPool, JackpotStage } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import { useAuthSession } from '../../../control/auth/auth-session';
import ConnectionBanner from './components/connection-banner.vue';
import { describeHostPresence } from './connection-labels';
import { describeProgress } from './console-guidance';
import { enterTriggers, resolveConsoleKey } from './console-keys';
import { useBusy } from './use-busy';

const props = defineProps<{ connection?: SessionConnection }>();

const route = useRoute();
const router = useRouter();
const { currentMember } = useAuthSession();
const { confirm } = useConfirm();

// 管理端末の接続はこの画面の寿命と一緒(画面を閉じたら切断。入室情報は残るのでリロードで復帰できる)。
const { state, connection } = useSessionConnection(props.connection ?? createSessionConnection());

const sessionId = computed(() => String(route.params.id ?? ''));
const joining = ref(false);
const errorMessage = ref('');
// 同時に1つだけ実行する操作の実行中の印と、失敗の通知(連打しても1回だけ送る)
const { busy: busyPath, run: runPath } = useBusy<string>(reportError);
const { busy: mainKey, run: runMainOrBack } = useBusy<'main' | 'back'>(reportError);
const busyMain = computed(() => mainKey.value !== null);
const { busy: busyStart, run: runStart } = useBusy<'quiz' | 'jackpot' | 'entry'>(reportError);
const { busy: busyEvent, run: runEvent } = useBusy<'start' | 'end'>(reportError);
const { busy: busyEntry, run: runEntry } = useBusy<'openEntry' | 'closeEntry'>(reportError);
const { busy: busyPool, run: runPool } = useBusy<DrawPool>(reportError);
const eventTitle = ref('');
const quizzes = ref<Array<{ id: string; title: string; question: string }>>([]);
const quizLoading = ref(false);
const selectedQuizId = ref('');
const nowMs = ref(Date.now());

const isDemo = computed(() => state.value.session?.mode === 'demo');
const q = (path: string) => (isDemo.value ? `${path}?demo=1` : path);

/** 会場の画面に映すエントリー受付（バブル）。ホストの許可リスト(isAllowedHostPath)にある画面。 */
const ENTRY_STAGE_PATH = '/event-entry';

/** ワンクリックで始めるときの、イベント名の既定値(クイズはクイズ名)。 */
const JACKPOT_EVENT_TITLE = 'ジャックポット抽選';
const ENTRY_EVENT_TITLE = 'エントリー受付';

const presets = computed(() => [
    { label: 'ロビー', path: lobbyPath(sessionId.value) },
    { label: 'エントリー受付(バブル)', path: ENTRY_STAGE_PATH },
    { label: 'ジャックポット: オープニング', path: q('/jackpot-opening') },
    { label: 'ジャックポット: エントリー', path: '/jackpot-entry' },
    { label: 'ジャックポット: 説明', path: q('/jackpot-description') },
    { label: 'ジャックポット: 抽選', path: q('/jackpot-draw') },
    { label: 'ジャックポット: 結果', path: q('/jackpot-result') },
    { label: 'ジャックポット: エンディング', path: q('/jackpot-ending') },
]);

const serverNow = computed(() => nowMs.value + state.value.serverOffsetMs);
const host = computed(() => describeHostPresence(state.value.presence?.host ?? null, serverNow.value));
const pending = computed(() => Math.max(0, state.value.headSeq - (state.value.presence?.host?.ackSeq ?? 0)));
const hostPath = computed(() => {
    const session = state.value.roomState?.data?.session as { path?: string } | undefined;
    return session?.path ?? '';
});
const jackpot = computed(() => readJackpotState(state.value.roomState?.data));
const STAGE_LABELS: Record<JackpotStage, string> = {
    waiting: '待機中',
    member: 'メンバー抽選',
    'member-revealed': 'メンバー抽選',
    prize: '賞品抽選',
    'prize-revealed': '賞品抽選',
    ended: '抽選終了',
};
const phaseLabel = computed(() => STAGE_LABELS[jackpot.value?.stage ?? 'waiting']);
interface QuizState {
    page: string;
    phase: string;
    title?: string;
}
const quizState = computed(() => (state.value.roomState?.data?.quiz as QuizState | undefined) ?? null);
const roundSummary = computed(() => state.value.round);
const QUIZ_PAGE_LABELS: Record<string, string> = { intro: 'イントロ', entry: 'エントリー受付', play: '出題中', answer: '正解発表', result: '結果発表' };
const quizPageLabel = computed(() => QUIZ_PAGE_LABELS[quizState.value?.page ?? ''] ?? '');
const quizPages = [
    { page: 'intro', label: 'イントロ' },
    { page: 'entry', label: 'エントリー' },
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
const drawPool = computed<DrawPool>(() => portalEvent.value?.pool ?? 'auto');
const poolLabel = computed(() => (drawPool.value === 'entrants' ? `エントリーした人のみ(${entryRoster.count.value}人)` : '参加者全員(自動)'));
/** 新しい順に最大50人。全員を並べると長くなるので、人数は別に出す。 */
const recentEntrants = computed(() => [...entryRoster.answers.value].reverse().slice(0, 50));
const entryTime = (atMs: number): string => new Date(atMs).toLocaleTimeString('ja-JP', { hour12: false });
const log = computed(() => [...state.value.recentCommands].reverse().slice(0, 15));
const canSend = computed(() => state.value.phase === 'connected' || state.value.phase === 'reconnecting');

/** 「いま」の説明と、主ボタン(押すと起きることの予告つき)。 */
const guidance = computed(() =>
    describeProgress({
        hostPath: hostPath.value,
        jackpot: jackpot.value,
        quiz: quizState.value,
        answerCount: roundSummary.value ? roundSummary.value.answerCount : null,
        hostOnline: host.value.online,
        demo: isDemo.value,
        pool: drawPool.value,
    })
);

function label(): string {
    return `${currentMember.value?.name ?? '管理者'}の管理端末`;
}

function reportError(e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    toast.error(parseHubErrorCode(message) ? stripHubErrorCode(message) : `送信できませんでした。通信状況を確認してください(${message})`);
}

async function join() {
    if (joining.value) return;
    joining.value = true;
    errorMessage.value = '';
    try {
        await connection.joinOperator({ sessionId: sessionId.value, role: 'admin', label: label() });
    } catch (e) {
        errorMessage.value = stripHubErrorCode((e instanceof Error ? e.message : String(e)));
    } finally {
        joining.value = false;
    }
}

const navigate = (path: string, before?: () => Promise<void>) =>
    runPath(path, async () => {
        await before?.();
        await connection.issue('session', 'navigate', { path });
    });

/** 主ボタン。連打しても1回だけ送る。 */
async function runMain() {
    const main = guidance.value.main;
    if (!main) return;
    // 押した時点で見ていたホストの画面を添える。ホストがもう進んでいたら破棄される(次の画面の操作と取り違えない)
    const expectedPath = hostPath.value;
    await runMainOrBack('main', async () => {
        if (main.action.kind === 'navigate') await connection.issue('session', 'navigate', { path: main.action.path, expectedPath });
        else if (main.action.kind === 'closeAnswers') await connection.issue('quiz', 'closeAnswers', { expectedPath });
        else await connection.issue(guidance.value.game === 'quiz' ? 'quiz' : 'jackpot', 'advance', { expectedPath });
    });
}

/** 副ボタン「前へ」。説明のスライドをひとつ戻す。 */
async function runBack() {
    if (!guidance.value.back) return;
    await runMainOrBack('back', async () => {
        await connection.issue('jackpot', 'back');
    });
}

/** イベントが開催されていなければ、名前を付けて開催する(ワンクリック開催の1段目)。 */
async function ensureEvent(title: string, pool?: DrawPool) {
    if (portalEvent.value) return;
    await connection.issue(PORTAL_EVENT_NS, PORTAL_EVENT_START, { title: normalizeEventTitle(title), ...(pool ? { pool } : {}) });
}

/** 選んでいるクイズの名前でイベントを開催する(未開催なら)。 */
const ensureQuizEvent = () => {
    const quiz = quizzes.value.find((x) => x.id === selectedQuizId.value);
    // クイズは参加者がエントリーして参加するので、対象は「エントリーした人のみ」で始める
    return ensureEvent(quiz?.title || quiz?.question || 'クイズ', 'entrants');
};

/** このクイズを始める: イベント開催(未開催なら) → イントロ画面。エントリー受付は、次のエントリー画面で自動で始まる。 */
const startQuiz = () =>
    runStart('quiz', async () => {
        await ensureQuizEvent();
        await connection.issue('session', 'navigate', { path: quizPath('intro') });
    });

/** ジャックポットを始める: イベント開催(未開催なら) → オープニング画面。抽選の対象は既定で参加者全員(自動)なので、受付は始めない。 */
const startJackpot = () =>
    runStart('jackpot', async () => {
        await ensureEvent(JACKPOT_EVENT_TITLE);
        await connection.issue('session', 'navigate', { path: q('/jackpot-opening') });
    });

/** エントリー受付を始める: イベント開催(未開催なら) → 受付開始 → 会場の画面に映す。 */
const startEntry = () =>
    runStart('entry', async () => {
        await ensureEvent(ENTRY_EVENT_TITLE, 'entrants');
        if (!portalEvent.value?.entry?.open) await connection.issue(PORTAL_EVENT_NS, PORTAL_EVENT_OPEN_ENTRY);
        await connection.issue('session', 'navigate', { path: ENTRY_STAGE_PATH });
    });

/** 参加者ポータルのイベントを開始(または切り替え)/終了する。ホストが公開し、参加者の画面に反映される。 */
async function sendEvent(type: 'start' | 'end') {
    if (busyEvent.value !== null) return;
    const title = normalizeEventTitle(eventTitle.value);
    if (type === 'start' && !title) return;
    if (type === 'end') {
        const ok = await confirm({
            title: 'イベントを終了しますか?',
            message: '参加者の画面の「イベント発生中」が消え、エントリー受付も終わります。',
            confirmLabel: '終了する',
            danger: true,
        });
        if (!ok) return;
    }
    await runEvent(type, async () => {
        await connection.issue(PORTAL_EVENT_NS, type === 'start' ? PORTAL_EVENT_START : PORTAL_EVENT_END, type === 'start' ? { title } : undefined);
        if (type === 'start') eventTitle.value = '';
    });
}

/** エントリー受付の開始/再開/締切。ホストが回答ラウンドを操作し、参加者の画面に反映される。 */
const sendEntry = (type: 'openEntry' | 'closeEntry') =>
    runEntry(type, async () => {
        await connection.issue(PORTAL_EVENT_NS, type === 'openEntry' ? PORTAL_EVENT_OPEN_ENTRY : PORTAL_EVENT_CLOSE_ENTRY);
    });

/** 抽選の対象の切り替え（全メンバー / エントリーした人だけ）。ホストが公開し、抽選にも反映される。 */
const sendPool = (mode: DrawPool) =>
    runPool(mode, async () => {
        await connection.issue(PORTAL_EVENT_NS, PORTAL_EVENT_SET_POOL, { mode });
    });

const startEvent = () => sendEvent('start');
const endEvent = () => sendEvent('end');

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

/** ホスト画面を見ながら Enter で主ボタンを押せる。入力欄やボタンにフォーカスがあるときは、その要素の操作を優先する。 */
function onKeydown(e: KeyboardEvent) {
    const command = resolveConsoleKey(e, { mainAction: guidance.value.main?.action ?? null, canBack: !!guidance.value.back, blocked: busyMain.value || !canSend.value });
    if (command === 'main') {
        e.preventDefault();
        void runMain();
    } else if (command === 'back') {
        e.preventDefault();
        void runBack();
    }
}

let clock: ReturnType<typeof setInterval> | null = null;
onMounted(() => {
    window.addEventListener('keydown', onKeydown);
    clock = setInterval(() => {
        nowMs.value = Date.now();
    }, 1000);
    // リロード後は保存済みの入室情報から復帰(同じセッションのときだけ)。無ければ入室する。
    void join();
    void loadQuizzes();
});
onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown);
    if (clock) clearInterval(clock);
});
</script>

<style scoped>
.console { display: flex; flex-direction: column; gap: var(--ui-space-3, 12px); padding: var(--ui-space-4, 16px) 4vw 32px; max-width: 960px; margin: 0 auto; width: 100%; box-sizing: border-box; }
.console__status { background: var(--ui-surface, #2b3036); border-radius: 12px; padding: 14px 16px; display: flex; flex-direction: column; gap: 4px; }
.console__status.is-offline { outline: 2px solid #ffb300; }
.console__now { margin: 0; font-size: 1.25rem; font-weight: 700; overflow-wrap: anywhere; }
.console__dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: #ff8a80; margin-right: 6px; }
.console__dot.is-on { background: #69f0ae; }
.console__sub { margin: 4px 0 0; font-size: 0.85rem; opacity: 0.75; overflow-wrap: anywhere; }
.console__sub.is-warn { color: #ffb300; opacity: 1; }
.console__warn { margin: 0; padding: 8px 12px; border-radius: 8px; background: rgba(255, 179, 0, 0.15); color: #ffd54f; }
.console__error { margin: 0; color: #ff8a80; }
.console__main { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.console__back { display: flex; flex-direction: column; gap: 6px; align-items: stretch; margin-top: 4px; }
.console__back-button { min-height: 48px; width: 100%; }
.console__key { margin-left: 10px; padding: 1px 8px; font-size: 0.8rem; font-weight: 600; border: 1px solid currentColor; border-radius: 6px; opacity: 0.7; vertical-align: middle; }
.console__main-button { min-height: 64px; font-size: 1.4rem; width: 100%; }
.console__hint { margin: 0; font-size: 0.95rem; opacity: 0.85; text-align: center; }
.console__h2 { margin: 8px 0 8px; font-size: 1rem; }
.console__h3 { margin: 16px 0 6px; font-size: 0.9rem; opacity: 0.8; }
.console__start-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
.console__start-card { background: var(--ui-surface, #2b3036); border-radius: 10px; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; justify-content: space-between; }
.console__presets { display: flex; flex-wrap: wrap; gap: 8px; }
.console__entry { display: flex; flex-direction: column; gap: 8px; }
.console__pool { display: flex; flex-direction: column; gap: 6px; align-items: flex-start; }
.console__end { display: flex; justify-content: flex-end; }
.console__entrants { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; max-height: 260px; overflow-y: auto; }
.console__entrants li { display: flex; gap: 12px; align-items: baseline; }
.console__event-form { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.console__event-form input { flex: 1 1 14em; max-width: 28em; min-width: 0; font: inherit; padding: 8px; border-radius: 6px; background: var(--ui-surface, #2b3036); color: inherit; border: 1px solid var(--ui-border, #3a4048); }
.console__quiz-select { display: flex; flex-direction: column; gap: 4px; font-size: 0.85rem; }
.console__quiz-select select { font: inherit; padding: 8px; border-radius: 6px; background: var(--ui-surface, #2b3036); color: inherit; border: 1px solid var(--ui-border, #3a4048); min-width: 0; }
.console__advanced { border-top: 1px solid var(--ui-border, #3a4048); padding-top: 8px; }
.console__advanced summary { cursor: pointer; opacity: 0.8; padding: 8px 0; }
.console__log { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.console__log li { display: flex; gap: 12px; align-items: baseline; }
.console__seq { font-variant-numeric: tabular-nums; opacity: 0.6; }
.console__ended { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
code { background: rgba(255, 255, 255, 0.1); padding: 1px 6px; border-radius: 4px; overflow-wrap: anywhere; }
@media (max-width: 640px) {
    .console__now { font-size: 1.1rem; }
    .console__main-button { min-height: 72px; }
}
</style>
