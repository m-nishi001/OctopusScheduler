<template>
    <div class="qr-container">
        <div class="qr-display">
            <img :src="qrCodeUrl" alt="QR Code" class="qr-large-image" />
            <p class="instruction">このQRコードを読み込んでください！</p>
            <p class="enter-hint">Enterで次へ進みます</p>

            <div class="status" aria-live="polite">
                <div v-if="isLoading" class="spinner" aria-hidden="true"></div>
                <p v-if="isLoading" class="status-text">読込中...</p>
                <p v-else-if="canProceed" class="status-complete">Read Completed !!</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { container } from 'tsyringe';
import type { QuizDto } from '../../../model/applications/dtos/quiz-dto';
import { StartQuizUseCase } from '../../../model/applications/use-cases/start-quiz-use-case';
import { QuizResultService } from '../../../model/services/quiz-result-service';

const router = useRouter();
const route = useRoute();

const quizId = route.params.id as string;

const quiz = ref<QuizDto | null>(null);

const qrCodeUrl = computed(() => {
    if (!quiz.value) return '';
    const q = quiz.value as QuizDto;
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(q.answerUrl)}`;
});

const isLoading = ref(false);
const canProceed = ref(false);

const quizResultService = container.resolve(QuizResultService);

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        if (!canProceed.value) return;
        // Navigate to the preview variant if this route is a preview route.
        const isPreviewRoute = String(route.name)?.endsWith('-preview');
        const routeName = isPreviewRoute ? 'quiz-play-preview' : 'quiz-play';
        router.push({ name: routeName, params: { id: quizId } });
    }
};

onMounted(async () => {
    const startQuizUseCase = container.resolve(StartQuizUseCase);
    quiz.value = await startQuizUseCase.execute(quizId);

    // Block Enter until GAS preload (email/name map) completes.
    isLoading.value = true;
    canProceed.value = false;
    try {
        await quizResultService.loadEmailNameMap();
        canProceed.value = true;
    } catch (err) {
        // keep canProceed false on error; surface via console for now
        // TODO: show user-facing error and/or retry option
        // eslint-disable-next-line no-console
        console.error('Failed to preload email/name map', err);
    } finally {
        isLoading.value = false;
    }

    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.qr-container {
    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.qr-display {
    background: rgba(17, 24, 39, 0.65);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.enter-hint {
    font-size: 1.1rem;
    color: #e6eef8;
    margin: 0;
}

.status {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    min-height: 48px;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 4px solid rgba(255, 255, 255, 0.12);
    border-top-color: #ffd54a;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

.status-text {
    color: #cbd5e1;
    font-size: 0.95rem;
}

.status-complete {
    color: #7ef78a;
    font-weight: bold;
    font-size: 1.05rem;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.qr-large-image {
    width: 400px;
    height: 400px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
}

.instruction {
    font-size: 1.8rem;
    font-weight: bold;
    color: #ffd54a;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: bounce 2s infinite;
}

@keyframes bounce {

    0%,
    20%,
    50%,
    80%,
    100% {
        transform: translateY(0);
    }

    40% {
        transform: translateY(-10px);
    }

    60% {
        transform: translateY(-5px);
    }
}

@media (max-width: 768px) {
    .qr-large-image {
        width: 300px;
        height: 300px;
    }

    .instruction {
        font-size: 1.5rem;
    }
}
</style>