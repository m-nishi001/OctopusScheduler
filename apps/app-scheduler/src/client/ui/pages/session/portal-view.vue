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
                <label class="portal__label" for="portal-name">表示名(任意)</label>
                <input id="portal-name" v-model="nameInput" class="portal__name-input" type="text" autocomplete="nickname" maxlength="30" :disabled="joining" />
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
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { UiButton } from '@octopus/ui-kit';
import { createSessionConnection, parseHubErrorCode, useSessionConnection } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import ConnectionBanner from './components/connection-banner.vue';
import { clientInputLabel } from './connection-labels';

const props = defineProps<{ connection?: SessionConnection }>();

const route = useRoute();
const router = useRouter();
const { state, connection } = useSessionConnection(props.connection ?? createSessionConnection());

const NAME_KEY = 'octopus.portal.name';

const codeInput = ref(String(route.params.code ?? '').toUpperCase());
const nameInput = ref(readName());
const joining = ref(false);
const errorMessage = ref('');
const busyKey = ref<string | null>(null);
const actionMessage = ref('');

const normalizedCode = computed(() => codeInput.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase());
const joined = computed(() => !!state.value.session && (state.value.phase === 'connected' || state.value.phase === 'reconnecting' || state.value.phase === 'joining'));
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

function readName(): string {
    try {
        return localStorage.getItem(NAME_KEY) ?? '';
    } catch {
        return '';
    }
}

function saveName(name: string): void {
    try {
        localStorage.setItem(NAME_KEY, name);
    } catch {
        // 保存できなくても参加には影響しない
    }
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
        const label = nameInput.value.trim();
        saveName(label);
        await connection.joinClient({ code: normalizedCode.value, label: label || undefined });
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
    if (normalizedCode.value.length === 6) void join();
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
.portal__waiting { opacity: 0.7; }
.portal__action { margin: 0; }
</style>
