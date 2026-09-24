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

            <div v-else-if="phase === 'waiting'" class="state-block">
                <p class="welcome">ようこそ、{{ session?.displayName }} さん</p>
                <div class="spinner" aria-hidden="true"></div>
                <p class="hint">出題をお待ちください...</p>
            </div>

            <div v-else-if="phase === 'answering'" class="answering-block">
                <p class="welcome">選んでください！</p>
                <div class="options-grid" role="list">
                    <OptionCard
                        v-for="(option, index) in options"
                        :key="option.no"
                        :option="{ no: option.no, text: option.text, color: option.color, image: null }"
                        :index="index"
                        @select="() => handleSelect(option.no)"
                    />
                </div>
                <p v-if="isSubmitting" class="hint">送信中...</p>
                <p v-if="submitError" class="error-text">{{ submitError }}</p>
            </div>

            <div v-else-if="phase === 'submitted'" class="state-block">
                <p class="welcome">回答を受け付けました！</p>
                <p class="hint">結果発表をお楽しみに</p>
            </div>

            <div v-else class="state-block">
                <p class="welcome">回答受付は終了しました</p>
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
import { SubmitAnswerUseCase } from '../../../control/use-cases/submit-answer-use-case';

const route = useRoute();
const quizId = route.params.id as string;

const { session, isRestoring, isLoggingIn, loginError, restore, login } = useParticipantSession();
const { state: acceptanceState, start: startPolling, stop: stopPolling } =
    useAcceptancePolling(quizId);

const submitUseCase = container.resolve(SubmitAnswerUseCase);

const userIdInput = ref('');
const hasSubmitted = ref(false);
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

const options = computed(() => acceptanceState.value?.options ?? []);

type Phase = 'loading' | 'login' | 'waiting' | 'answering' | 'submitted' | 'closed';

const phase = computed<Phase>(() => {
    if (isRestoring.value) return 'loading';
    if (!session.value) return 'login';
    if (hasSubmitted.value) return 'submitted';
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
    if (!session.value || isSubmitting.value) return;
    isSubmitting.value = true;
    submitError.value = null;
    try {
        await submitUseCase.execute(quizId, session.value.token, optionNo);
        hasSubmitted.value = true;
    } catch (e) {
        submitError.value = e instanceof Error ? e.message : String(e);
    } finally {
        isSubmitting.value = false;
    }
}

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
