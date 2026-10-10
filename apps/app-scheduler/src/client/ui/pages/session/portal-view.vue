<template>
    <div class="portal">
        <header class="portal__header">
            <h1 class="portal__title">🐙 参加ポータル</h1>
            <ConnectionBanner v-if="joined || state.phase === 'reconnecting'" :phase="state.phase" :failure-count="state.failureCount" />
        </header>

        <main class="portal__main">
            <!-- 入室前: 参加コードの入力 -->
            <form v-if="!joined && state.phase !== 'unauthorized' && state.phase !== 'ended'" class="portal__form" @submit.prevent="join">
                <label class="portal__label" for="portal-code">参加コード</label>
                <input id="portal-code" v-model="codeInput" class="portal__code-input" type="text" inputmode="latin" autocomplete="off"
                    autocapitalize="characters" maxlength="6" placeholder="ABC234" :disabled="joining" />
                <template v-if="members.length > 0">
                    <label class="portal__label" for="portal-member">あなたの名前(メンバーから選ぶ)</label>
                    <select id="portal-member" v-model="memberId" class="portal__name-input" :disabled="joining">
                        <option value="">ゲストとして参加</option>
                        <option v-for="m in members" :key="m.id" :value="m.id">{{ m.name }}</option>
                    </select>
                </template>
                <label v-if="!memberId" class="portal__label" for="portal-name">表示名(任意)</label>
                <input v-if="!memberId" id="portal-name" v-model="nameInput" class="portal__name-input" type="text" autocomplete="nickname" maxlength="30" :disabled="joining" />
                <UiButton type="submit" variant="primary" :loading="joining" :disabled="normalizedCode.length < 6">参加する</UiButton>
                <p v-if="errorMessage" class="portal__error" role="alert">{{ errorMessage }}</p>
            </form>

            <!-- 認証切れ・終了 -->
            <div v-else-if="state.phase === 'unauthorized'" class="portal__notice">
                <p>接続が切れました。もう一度参加してください。</p>
                <UiButton variant="primary" :loading="joining" @click="rejoin">再参加する</UiButton>
            </div>
            <div v-else-if="state.phase === 'ended'" class="portal__notice">
                <p>このセッションは終了しました。ご参加ありがとうございました。</p>
                <UiButton @click="reset">別のコードで参加する</UiButton>
            </div>

            <!-- 参加中 -->
            <template v-else-if="state.session">
                <h2 class="portal__session">{{ state.session.name }}</h2>
                <p class="portal__presence" :class="{ 'is-offline': !hostOnline }">
                    {{ hostOnline ? 'ホスト接続中' : 'ホストの接続を待っています' }}
                    ・ 参加者 {{ state.presence?.clientCount ?? 0 }} 人
                </p>

                <p v-if="screenLabel" class="portal__screen">{{ screenLabel }}</p>

                <section v-if="jackpot && (jackpot.member || jackpot.prize)" class="portal__winner" data-testid="winner" aria-live="polite">
                    <p v-if="jackpot.member" class="portal__winner-line">🎉 当選者: <strong>{{ jackpot.member }}</strong></p>
                    <p v-if="jackpot.prize" class="portal__winner-line">🎁 賞品: <strong>{{ jackpot.prize }}</strong></p>
                </section>

                <section v-if="quiz" class="portal__quiz" data-testid="quiz-panel" aria-live="polite">
                    <h3 v-if="quiz.title" class="portal__quiz-title">{{ quiz.title }}</h3>
                    <template v-if="quiz.page === 'play'">
                        <p class="portal__question">{{ quiz.question }}</p>
                        <p v-if="quiz.phase === 'answering' && remainingSec !== null" class="portal__timer" data-testid="quiz-timer">残り {{ remainingSec }} 秒</p>
                        <div class="portal__options" role="group" aria-label="選択肢">
                            <button v-for="o in quiz.options" :key="o.no" type="button" class="portal__option"
                                :class="{ 'is-chosen': myAnswer === o.no }" :style="{ '--option-color': o.color || '#3b82f6' }"
                                :disabled="!canAnswer" :aria-pressed="myAnswer === o.no" @click="answerQuiz(o.no)">
                                <span class="portal__option-no">{{ o.no }}</span>{{ o.text }}
                            </button>
                        </div>
                        <p v-if="myAnswer !== null" class="portal__answered" data-testid="quiz-answered">回答しました(選択: {{ optionLabel(myAnswer) }})</p>
                        <p v-else-if="quiz.phase === 'closed' || (remainingSec !== null && remainingSec <= 0)" class="portal__closed" data-testid="quiz-closed">受付は終了しました</p>
                        <p v-if="quizMessage" class="portal__action" role="alert">{{ quizMessage }}</p>
                    </template>
                    <template v-else-if="quiz.page === 'answer'">
                        <p class="portal__question">{{ quiz.question }}</p>
                        <p class="portal__correct" data-testid="quiz-correct">正解: {{ correctLabel }}</p>
                        <p v-if="myAnswer !== null" class="portal__verdict" :class="myAnswer === quiz.correctNo ? 'is-correct' : 'is-wrong'" data-testid="quiz-verdict">
                            {{ verdictText }}
                        </p>
                        <p v-else class="portal__closed">あなたは回答していません</p>
                    </template>
                    <p v-else-if="quiz.page === 'result'" class="portal__waiting">結果発表中です。画面をご覧ください。</p>
                    <p v-else class="portal__waiting">クイズが始まります。しばらくお待ちください。</p>
                </section>

                <section v-if="inputs.length > 0" class="portal__inputs" aria-label="受付中の操作">
                    <UiButton v-for="key in inputs" :key="key" class="portal__input-btn" variant="primary" :disabled="busyKey !== null"
                        :loading="busyKey === key" @click="send(key)">
                        {{ clientInputLabel(key) }}
                    </UiButton>
                </section>
                <p v-else class="portal__waiting">操作の受付が始まるまでお待ちください。</p>

                <p v-if="actionMessage" class="portal__action" role="status">{{ actionMessage }}</p>
                <UiButton size="sm" variant="ghost" @click="leave">退出する</UiButton>
            </template>
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { UiButton } from '@octopus/ui-kit';
import { AccountsRepository } from '@octopus/accounts';
import { createSessionConnection, parseHubErrorCode, useSessionConnection } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import ConnectionBanner from './components/connection-banner.vue';
import { clientInputLabel } from './connection-labels';

const props = defineProps<{ connection?: SessionConnection }>();

const route = useRoute();
const router = useRouter();
const { state, connection } = useSessionConnection(props.connection ?? createSessionConnection());

const NAME_KEY = 'octopus.portal.name';
const MEMBER_KEY = 'octopus.portal.member';

interface QuizOption {
    no: number;
    text: string;
    color: string;
}
interface QuizView {
    page: 'intro' | 'qr' | 'play' | 'answer' | 'result';
    title: string;
    roundKey: string | null;
    deadlineMs: number | null;
    phase: 'idle' | 'answering' | 'closed';
    question: string | null;
    options: QuizOption[];
    correctNo: number | null;
}

const codeInput = ref(String(route.params.code ?? '').toUpperCase());
const nameInput = ref(readName());
const joining = ref(false);
const errorMessage = ref('');
const busyKey = ref<string | null>(null);
const actionMessage = ref('');

const normalizedCode = computed(() => codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
const joined = computed(() => !!state.value.session && (state.value.phase === 'connected' || state.value.phase === 'reconnecting' || state.value.phase === 'joining'));
// ---- クイズ(回答ラウンド) ----
const members = ref<Array<{ id: string; name: string }>>([]);
const memberId = ref(readStored(MEMBER_KEY));
const myAnswer = ref<number | null>(null);
const answering = ref(false);
const quizMessage = ref('');
const nowMs = ref(Date.now());
let clock: ReturnType<typeof setInterval> | null = null;

const quiz = computed(() => (state.value.roomState?.data as { quiz?: QuizView } | undefined)?.quiz ?? null);
/** 締切までの秒数。端末の時計ではなくサーバ時刻との差(serverOffsetMs)で出すので、端末の時計がずれていても揃う。 */
const remainingSec = computed(() => {
    const deadline = quiz.value?.deadlineMs;
    if (deadline === null || deadline === undefined) return null;
    return Math.max(0, Math.ceil((deadline - (nowMs.value + state.value.serverOffsetMs)) / 1000));
});
const canAnswer = computed(
    () => quiz.value?.phase === 'answering' && (remainingSec.value ?? 0) > 0 && myAnswer.value === null && !answering.value,
);
const optionLabel = (no: number): string => {
    const o = quiz.value?.options.find((x) => x.no === no);
    return o ? no + '. ' + o.text : String(no);
};
const correctLabel = computed(() => (quiz.value?.correctNo != null ? optionLabel(quiz.value.correctNo) : ''));
const verdictText = computed(() => {
    if (myAnswer.value === null) return '';
    return myAnswer.value === quiz.value?.correctNo ? '正解！' : '残念… あなたの回答: ' + optionLabel(myAnswer.value);
});

const answerStorageKey = (): string | null => {
    const sessionId = state.value.session?.id;
    const key = quiz.value?.roundKey;
    return sessionId && key ? 'octopus.quiz.answer:' + sessionId + ':' + key : null;
};

// 問題(ラウンド)が変わったら、保存してある自分の回答を読み直す(リロードしても回答済み表示が残る)。
// 文字列で比較する(配列を返すと、更新のたびに「変わった」と判定されて回答済みの表示や案内が消えてしまう)。
watch(
    () => String(state.value.session?.id) + '|' + String(quiz.value?.roundKey),
    () => {
        quizMessage.value = '';
        const k = answerStorageKey();
        const saved = k ? readStored(k) : '';
        myAnswer.value = saved ? Number(saved) : null;
    },
    { immediate: true },
);

async function answerQuiz(no: number) {
    const key = quiz.value?.roundKey;
    if (!canAnswer.value || !key) return;
    answering.value = true;
    quizMessage.value = '';
    try {
        const result = await connection.answer(key, no);
        myAnswer.value = result.no;
        const k = answerStorageKey();
        if (k) writeStored(k, String(result.no));
        if (result.duplicate) quizMessage.value = 'すでに回答済みです(選択: ' + optionLabel(result.no) + ')';
    } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        const code = parseHubErrorCode(message);
        quizMessage.value =
            code === 'ROUND_CLOSED' || code === 'ROUND_NOT_OPEN'
                ? '受付は終了しました'
                : code
                  ? message.replace(/^\[[A-Z_]+\]\s*/, '')
                  : '通信できませんでした。電波の良い場所で、もう一度押してください';
    } finally {
        answering.value = false;
    }
}

const jackpot = computed(
    () => (state.value.roomState?.data as { jackpot?: { member: string | null; prize: string | null } } | undefined)?.jackpot ?? null,
);
const inputs = computed(() => state.value.roomState?.clientInput ?? []);
const hostOnline = computed(() => {
    const seen = state.value.presence?.host?.seenAtMs;
    if (!seen) return false;
    return Date.now() + state.value.serverOffsetMs - seen <= 30_000;
});
const screenLabel = computed(() => {
    const data = state.value.roomState?.data as { session?: { path?: string } } | undefined;
    const path = data?.session?.path ?? '';
    if (!path) return '';
    if (path.startsWith('/session/host/')) return 'ロビー';
    if (path.includes('jackpot')) return 'ジャックポット';
    if (path.includes('/quiz/')) return 'クイズ';
    return '';
});

function readStored(key: string): string {
    try {
        return localStorage.getItem(key) ?? '';
    } catch {
        return '';
    }
}

function writeStored(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
    } catch {
        // 保存できなくても動作には影響しない
    }
}

function readName(): string {
    return readStored(NAME_KEY);
}
function saveName(name: string): void {
    writeStored(NAME_KEY, name);
}

function friendly(e: unknown): string {
    const message = e instanceof Error ? e.message : String(e);
    return parseHubErrorCode(message) ? message.replace(/^\[[A-Z_]+\]\s*/, '') : `通信できませんでした。電波の良い場所でもう一度お試しください(${message})`;
}

async function join() {
    if (joining.value || normalizedCode.value.length < 6) return;
    joining.value = true;
    errorMessage.value = '';
    try {
        const picked = members.value.find((m) => m.id === memberId.value);
        const label = (picked ? picked.name : nameInput.value).trim();
        if (picked) writeStored(MEMBER_KEY, picked.id);
        else saveName(label);
        await connection.joinClient({ code: normalizedCode.value, label: label || undefined, memberId: picked?.id });
        // URL のコードを揃えておく(リロードしても同じコードで復帰できる)
        if (route.params.code !== normalizedCode.value) await router.replace(`/portal/${normalizedCode.value}`);
    } catch (e) {
        errorMessage.value = friendly(e);
    } finally {
        joining.value = false;
    }
}

/** 認証が切れたとき、保持している参加コードで入り直す。 */
async function rejoin() {
    const code = state.value.code ?? normalizedCode.value;
    if (code) codeInput.value = code;
    await join();
}

function reset() {
    connection.leave();
    codeInput.value = '';
    errorMessage.value = '';
    void router.replace('/portal');
}

function leave() {
    reset();
}

async function send(key: string) {
    if (busyKey.value !== null) return;
    const [game, type] = key.split('.');
    busyKey.value = key;
    actionMessage.value = '';
    try {
        await connection.issue(game, type);
        actionMessage.value = '送信しました';
    } catch (e) {
        actionMessage.value = parseHubErrorCode(e instanceof Error ? e.message : '') === 'FORBIDDEN' ? '受付が終了しました' : friendly(e);
    } finally {
        busyKey.value = null;
    }
}

onMounted(() => {
    clock = setInterval(() => {
        nowMs.value = Date.now();
    }, 250);
    const routeCode = String(route.params.code ?? '').toUpperCase();
    // 保存済みの入室情報があり、URLのコードが無い/同じならそのまま復帰する(誤リロード対策)。
    if (connection.resume('client')) {
        const stored = connection.state.code;
        // 別のコードのURLを開いた場合は復帰せず、そのコードで入り直す
        if (routeCode && stored && stored !== routeCode) {
            connection.leave();
            void join();
        }
        return;
    }
    void (async () => {
        // 参加者名簿(メンバー)。選ぶと回答が個人に紐づき、クイズの順位に名前が出る。取得できなくてもゲスト参加できる。
        try {
            const list = await container.resolve(AccountsRepository).listMembers();
            members.value = list.map((m) => ({ id: m.id, name: m.name }));
            if (!members.value.some((m) => m.id === memberId.value)) memberId.value = '';
        } catch {
            // 名簿が取れなくてもゲストとして参加できる
        }
        // URL(QR)のコードで開いた場合、名簿があれば名前を選ぶ画面を出す(自動参加すると必ずゲストになるため)。
        if (members.value.length === 0 && normalizedCode.value.length === 6) void join();
    })();
});

onUnmounted(() => {
    if (clock) clearInterval(clock);
});

watch(
    () => state.value.phase,
    (phase) => {
        if (phase === 'connected') errorMessage.value = '';
    },
);
</script>

<style scoped>
.portal { min-height: 100vh; min-height: 100dvh; background: var(--ui-bg, #23252b); color: var(--ui-text, #fff); display: flex; flex-direction: column; box-sizing: border-box; padding: 16px; gap: 16px; }
.portal__header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
.portal__title { margin: 0; font-size: 1.2rem; }
.portal__main { flex: 1; display: flex; flex-direction: column; gap: 14px; align-items: stretch; max-width: 480px; width: 100%; margin: 0 auto; }
.portal__form { display: flex; flex-direction: column; gap: 10px; }
.portal__label { font-size: 0.85rem; opacity: 0.8; }
.portal__code-input, .portal__name-input { font: inherit; padding: 12px; border-radius: 8px; border: 1px solid var(--ui-border, #3a4048); background: var(--ui-surface, #2b3036); color: inherit; }
.portal__code-input { font-size: 1.8rem; letter-spacing: 0.3em; text-align: center; text-transform: uppercase; }
.portal__error { color: #ff8a80; margin: 0; }
.portal__notice { display: flex; flex-direction: column; gap: 10px; align-items: flex-start; }
.portal__session { margin: 0; font-size: 1.5rem; }
.portal__presence { margin: 0; opacity: 0.8; }
.portal__presence.is-offline { color: #ffd54f; }
.portal__screen { margin: 0; font-size: 1.1rem; font-weight: 700; }
.portal__inputs { display: flex; flex-direction: column; gap: 12px; }
.portal__input-btn { min-height: 64px; font-size: 1.2rem; }
.portal__winner { padding: 12px 16px; border-radius: 12px; background: rgba(255, 215, 64, 0.15); }
.portal__winner-line { margin: 4px 0; font-size: 1.2rem; }
.portal__quiz { display: flex; flex-direction: column; gap: 10px; }
.portal__quiz-title { margin: 0; font-size: 1rem; opacity: 0.8; }
.portal__question { margin: 0; font-size: 1.25rem; font-weight: 700; line-height: 1.5; }
.portal__timer { margin: 0; font-size: 1.4rem; font-weight: 800; font-variant-numeric: tabular-nums; color: #ffd54f; }
.portal__options { display: flex; flex-direction: column; gap: 10px; }
.portal__option { display: flex; align-items: center; gap: 12px; min-height: 64px; padding: 12px 16px; border-radius: 12px; border: 3px solid var(--option-color); background: color-mix(in srgb, var(--option-color) 25%, #1a1d23); color: #fff; font: inherit; font-size: 1.1rem; font-weight: 700; text-align: left; cursor: pointer; }
.portal__option:disabled { opacity: 0.55; cursor: default; }
.portal__option.is-chosen { opacity: 1; background: var(--option-color); box-shadow: 0 0 0 3px #fff; }
.portal__option-no { display: inline-flex; width: 1.8em; height: 1.8em; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255, 255, 255, 0.2); }
.portal__answered { margin: 0; font-weight: 700; color: #81c784; }
.portal__closed { margin: 0; opacity: 0.8; }
.portal__correct { margin: 0; font-size: 1.3rem; font-weight: 800; color: #ffd54f; }
.portal__verdict { margin: 0; font-size: 1.4rem; font-weight: 800; }
.portal__verdict.is-correct { color: #81c784; }
.portal__verdict.is-wrong { color: #ff8a80; }
.portal__waiting { opacity: 0.7; }
.portal__action { margin: 0; }
</style>
