<template>
    <div class="participant-container">
        <div class="card">
            <div v-if="phase === 'loading'" class="state-block">
                <div class="spinner" aria-hidden="true"></div>
                <p class="hint">読み込み中...</p>
            </div>

            <form v-else-if="phase === 'login'" class="login-form" @submit.prevent="handleLogin">
                <h1 class="title">クイズに参加</h1>
                <p class="hint">配布されたユーザーIDを入力してください</p>
                <input
                    v-model="userIdInput"
                    class="user-id-input"
                    type="text"
                    inputmode="text"
                    autocomplete="off"
                    autocapitalize="off"
                    placeholder="ユーザーID"
                    :disabled="isLoggingIn"
                />
                <button
                    class="submit-button"
                    type="submit"
                    :disabled="isLoggingIn || !userIdInput.trim()"
                >
                    {{ isLoggingIn ? 'ログイン中...' : '参加する' }}
                </button>
                <p v-if="loginError" class="error-text">
                    ユーザーIDが見つかりません。管理者に確認してください。
                </p>
            </form>

            <div v-else-if="phase === 'expired'" class="state-block">
                <p class="welcome">このQRコードは期限切れです</p>
                <p class="hint">会場の画面に表示されている最新のQRコードを読み取り直してください</p>
            </div>

            <div v-else-if="phase === 'waiting'" class="state-block">
                <p class="welcome">ようこそ、{{ session?.displayName }} さん</p>
                <div class="spinner" aria-hidden="true"></div>
                <p class="hint">出題をお待ちください...</p>
            </div>

            <div v-else-if="phase === 'answering'" class="answering-block">
                <p class="welcome">
                    {{ selectedNo === null ? '選んでください！' : '回答を受け付けました！受付中は変更できます' }}
                </p>
                <div class="options-grid" role="list">
                    <OptionCard
                        v-for="(option, index) in options"
                        :key="option.no"
                        :option="{ no: option.no, text: option.text, color: option.color, imageUrl: imageUrls[option.no] ?? null }"
                        :index="index"
                        :variant="selectedNo === option.no ? 'selected' : undefined"
                        @select="() => handleSelect(option.no)"
                    />
                </div>
                <p v-if="isSubmitting" class="hint">送信中...</p>
                <p v-if="submitError" class="error-text">{{ submitError }}</p>
            </div>

            <div v-else class="state-block">
                <p class="welcome">回答受付は終了しました</p>
                <p v-if="selectedNo !== null" class="hint">結果発表をお楽しみに</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import OptionCard from '../../components/option-card.vue';
import { useParticipantSession } from '../../composables/use-participant-session';
import { useAcceptancePolling } from '../../composables/use-acceptance-polling';
import { useQuizSession } from '../../composables/use-quiz-session';
import { SubmitAnswerUseCase } from '../../../control/use-cases/submit-answer-use-case';
import { GetOptionImageUseCase } from '../../../control/use-cases/get-option-image-use-case';

const route = useRoute();
const quizId = route.params.id as string;
const quizSession = useQuizSession();

const { session, isRestoring, isLoggingIn, loginError, restore, login } = useParticipantSession();
// 参加URLに埋め込まれたトークン。QRが新しいセッションに切り替わると無効になる。
const joinToken = typeof route.query.t === 'string' ? route.query.t : '';
const { state: acceptanceState, myAnswerNo, isLinkExpired, start: startPolling, stop: stopPolling } =
    useAcceptancePolling(quizId, quizSession.scope, joinToken, () => session.value?.token);

const submitUseCase = container.resolve(SubmitAnswerUseCase);
const getOptionImageUseCase = container.resolve(GetOptionImageUseCase);

const userIdInput = ref('');
// 画面上の選択。サーバーの自分の回答(myAnswerNo)と同期するため、リロードしても失われない。
const selectedNo = ref<number | null>(null);
const imageUrls = ref<Record<number, string>>({});
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

const options = computed(() => acceptanceState.value?.options ?? []);

type Phase = 'loading' | 'login' | 'expired' | 'waiting' | 'answering' | 'closed';

const phase = computed<Phase>(() => {
    if (isRestoring.value) return 'loading';
    if (isLinkExpired.value || !joinToken) return 'expired';
    if (!session.value) return 'login';
    if (!acceptanceState.value) return 'waiting';
    if (acceptanceState.value.isAccepting) return 'answering';
    if (acceptanceState.value.acceptStartedAtMs === null) return 'waiting';
    return 'closed';
});

async function handleLogin() {
    const userId = userIdInput.value.trim();
    if (!userId) return;
    await login(userId);
}

async function handleSelect(optionNo: number) {
    if (!session.value || isSubmitting.value || phase.value !== 'answering') return;
    isSubmitting.value = true;
    submitError.value = null;
    try {
        await submitUseCase.execute(quizId, quizSession.scope, joinToken, session.value.token, optionNo);
        selectedNo.value = optionNo;
    } catch (e) {
        submitError.value = e instanceof Error ? e.message : String(e);
    } finally {
        isSubmitting.value = false;
    }
}

// サーバー側の自分の回答を反映する(リロード復元・次のラウンドでのリセット)。送信中は上書きしない。
watch(myAnswerNo, (value) => {
    if (!isSubmitting.value) selectedNo.value = value;
});

// サムネイルは状態ポーリングに載せず、受付開始ごとに画像ありの選択肢だけ個別に取得する。
watch(
    () => acceptanceState.value?.acceptStartedAtMs,
    async () => {
        const opts = acceptanceState.value?.options ?? [];
        const next: Record<number, string> = {};
        await Promise.all(
            opts.map(async (option, index) => {
                if (!option.hasImage) return;
                try {
                    const url = await getOptionImageUseCase.execute(quizId, quizSession.scope, joinToken, index);
                    if (url) next[option.no] = url;
                } catch {
                    // 画像が取れなくてもテキストで回答できるため無視する
                }
            })
        );
        imageUrls.value = next;
    }
);

watch(session, (value) => {
    if (value) startPolling();
});

onMounted(async () => {
    await restore();
});

onUnmounted(() => {
    stopPolling();
});
</script>

<style scoped>
.participant-container {
    width: 100%;
    min-height: 100vh;
    box-sizing: border-box;
    padding: 20px 16px;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
}

.card {
    width: 100%;
    max-width: 480px;
    background: rgba(17, 24, 39, 0.65);
    border-radius: 16px;
    padding: 28px 20px;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
    box-sizing: border-box;
}

.state-block,
.login-form,
.answering-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
}

.title {
    font-size: 1.6rem;
    font-weight: 800;
    color: #ffd54a;
    margin: 0;
}

.welcome {
    font-size: 1.2rem;
    font-weight: 700;
    margin: 0;
}

.hint {
    font-size: 0.95rem;
    color: rgba(255, 255, 255, 0.75);
    margin: 0;
}

.user-id-input {
    width: 100%;
    box-sizing: border-box;
    font-size: 1.1rem;
    padding: 14px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.06);
    color: #fff;
}

.user-id-input::placeholder {
    color: rgba(255, 255, 255, 0.4);
}

.submit-button {
    width: 100%;
    font-size: 1.1rem;
    font-weight: 800;
    padding: 14px 16px;
    border-radius: 10px;
    border: none;
    cursor: pointer;
    background: #ffd54a;
    color: #1a1a1a;
}

.submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.error-text {
    color: #fca5a5;
    font-size: 0.9rem;
    margin: 0;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 4px solid rgba(255, 255, 255, 0.12);
    border-top-color: #ffd54a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.options-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
}

.options-grid > * {
    aspect-ratio: 1 / 1;
}

@media (max-width: 360px) {
    .card {
        padding: 20px 14px;
    }

    .title {
        font-size: 1.4rem;
    }
}
</style>
