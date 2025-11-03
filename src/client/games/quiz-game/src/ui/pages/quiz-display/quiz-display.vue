<template>
    <div v-if="quiz" class="quiz-container">
        <div class="timer-pill" :class="{ 'urgent': timeLeft <= 10 }" aria-hidden="false">
            <span class="time">{{ timeLeft }}</span>
            <span class="unit">秒</span>
        </div>
        <header class="quiz-header">
            <div class="header-row">
                <div class="qr-inline" aria-hidden="false">
                    <img :src="qrCodeUrl" alt="QR Code" class="qr-image qr-inline-image" />
                </div>
                <div class="header-content">
                    <div class="title-card" aria-hidden="false">
                        <h1 class="quiz-title">{{ quiz.title }}</h1>
                        <p class="quiz-content">{{ quiz.question }}</p>
                    </div>
                </div>
            </div>
        </header>
        <section class="question-area" aria-live="polite">
            <div class="options-grid" role="list">
                <div v-for="(option, index) in optionsWithImageUrls" :key="index" role="listitem">
                    <button class="option-button" :style="{ '--option-color': option.color }"
                        @click="selectOption(index)" :aria-label="option.text">
                        <div class="image-wrapper">
                            <img v-if="option.imageUrl" :src="option.imageUrl" :alt="option.text"
                                class="option-image" />
                            <div class="option-index">{{ index + 1 }}</div>
                            <div class="text-ribbon" aria-hidden="false">
                                <span class="option-text">{{ option.text }}</span>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </section>
        <div v-if="showModal" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card">
                <h2 class="modal-title">終了！</h2>
                <p class="modal-body">回答時間が終了しました。</p>
            </div>
        </div>
    </div>
    <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import type { QuizDto } from '../../../model/applications/dtos/quiz-dto';
import { StartQuizUseCase } from '../../../model/applications/use-cases/start-quiz-use-case';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;

const quiz = ref<QuizDto | null>(null);

const timeLeft = ref(0);
const showModal = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;

const qrCodeUrl = computed(() => {
    if (!quiz.value) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(quiz.value.formUrl)}`;
});

const optionsWithImageUrls = computed(() => {
    if (!quiz.value) return [];
    return quiz.value.options.map(option => ({
        ...option,
        imageUrl: option.image ? URL.createObjectURL(option.image) : null,
    }));
});

onMounted(async () => {
    const startQuizUseCase = container.resolve(StartQuizUseCase);
    quiz.value = await startQuizUseCase.execute(quizId);
    if (quiz.value) {
        timeLeft.value = quiz.value.timeLimit;
        startTimer();
    }
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('keydown', handleKeydown);
    // Clean up object URLs
    if (quiz.value) {
        quiz.value.options.forEach(option => {
            if (option.image) {
                URL.revokeObjectURL(URL.createObjectURL(option.image));
            }
        });
    }
});

const startTimer = () => {
    timer = setInterval(() => {
        timeLeft.value--;
        if (timeLeft.value <= 0) {
            if (timer) clearInterval(timer);
            showModal.value = true;
        }
    }, 1000);
};

const selectOption = (index: number) => {
    console.log('Selected option:', index);
};

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        router.push(`/quiz-result/${quizId}`);
    }
};
</script><!-- Global (non-scoped) rules: hide visible scrollbars but keep ability to scroll if needed -->
<style>
html,
body,
#app {
    height: 100%;
}

body {
    -ms-overflow-style: none;
    scrollbar-width: none;
}

body::-webkit-scrollbar {
    width: 0;
    height: 0;
}
</style>

<style scoped>
:root {
    --card-bg: rgba(17, 24, 39, 0.65);
    --muted: rgba(255, 255, 255, 0.85);
}

.quiz-container {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    border-radius: 0;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    color: #fff;
    display: flex;
    flex-direction: column;
    position: relative;
}

.quiz-header {
    margin-bottom: 12px;
}

.header-row {
    display: flex;
    align-items: stretch;
    gap: 18px;
}

.header-content {
    flex: 1 1 auto;
    display: flex;
    align-items: center;
}

.title-card {
    background: var(--card-bg);
    border-radius: 12px;
    padding: 20px 22px;
    width: 100%;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: 6px;
    justify-content: center;
}

.quiz-preview {
    margin: 0;
    color: var(--muted);
    opacity: 0.95;
    font-size: 1rem;
}

.quiz-title {
    font-size: 2.25rem;
    font-weight: 800;
    color: #ffd54a;
    margin: 0;
    letter-spacing: 0.02em;
}

.timer-pill {
    position: absolute;
    top: 14px;
    right: 18px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--muted);
    padding: 14px 18px;
    min-width: 72px;
    min-height: 72px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-weight: 800;
    box-shadow: 0 10px 26px rgba(2, 6, 23, 0.6);
    transition: transform 0.18s ease, background-color 0.18s ease;
}

.timer-pill.urgent {
    background: linear-gradient(90deg, #ff6b6b, #ff3b3b);
    color: #fff;
    transform: scale(1.06);
}

.timer-pill .time {
    font-size: 2.2rem;
    line-height: 1;
}

.timer-pill .unit {
    font-size: 0.75rem;
    opacity: 0.85;
}

.question-area {
    text-align: center;
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1 1 auto;
}

.question-text {
    background: var(--card-bg);
    display: inline-block;
    padding: 18px 22px;
    border-radius: 12px;
    font-size: 1.375rem;
    margin-bottom: 12px;
    max-width: 900px;
    flex: 0 0 auto;
}

.quiz-content {
    background: transparent;
    margin: 0;
    font-size: 1.375rem;
    color: var(--muted);
}

.options-grid {
    flex: 1 1 auto;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(2, minmax(360px, 1fr));
    grid-auto-rows: 1fr;
    gap: clamp(8px, 1.2vw, 20px);
    margin-top: 0px;
    align-items: stretch;
    align-content: stretch;
}

.option-button {
    --bg: var(--option-color, #334155);
    width: 100%;
    padding: 0;
    height: 100%;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    color: #fff;
    display: block;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.06));
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.55);
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
    font-weight: 900;
    text-align: left;
    overflow: hidden;
    position: relative;
}

.option-button:active {
    transform: translateY(2px) scale(0.998);
}

.option-button:hover {
    transform: translateY(-6px);
    filter: brightness(1.03);
}

.image-wrapper {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 220px;
    background: var(--bg);
    display: block;
    overflow: hidden;
}

.option-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 16px;
    transform-origin: center;
    transition: transform 250ms ease;
}

.option-button:hover .option-image {
    transform: scale(1.06);
}

.option-index {
    position: absolute;
    top: 12px;
    left: 12px;
    min-width: 48px;
    height: 48px;
    border-radius: 999px;
    background: var(--option-color, rgba(255, 255, 255, 0.12));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1rem;
    box-shadow: 0 8px 18px rgba(2, 6, 23, 0.5);
    z-index: 3;
}

.text-ribbon {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
}

.option-text {
    font-size: 1rem;
    color: #fff;
    font-weight: 800;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 56px);
}

.qr-inline {
    display: flex;
    align-items: center;
    margin-right: 16px;
}

.qr-inline-image {
    width: 168px;
    height: 168px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
}

.qr-image {
    width: 168px;
    height: 168px;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(2, 6, 23, 0.72);
    z-index: 60;
}

.modal-card {
    background: linear-gradient(90deg, #ef4444, #fb7185);
    width: min(820px, 86%);
    max-width: 920px;
    min-height: 260px;
    padding: 56px 56px;
    border-radius: 16px;
    color: white;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    box-shadow: 0 28px 80px rgba(2, 6, 23, 0.7);
    transform: translateZ(0);
}

.modal-title {
    font-size: 3.2rem;
    line-height: 1;
    margin: 0 0 18px 0;
}

.modal-body {
    font-size: 1.25rem;
    margin: 0;
    opacity: 0.98;
}

.loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-size: 1.5rem;
    color: #fff;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);

    @media (max-width: 640px) {
        .modal-card {
            width: calc(100% - 40px);
            min-height: 200px;
            padding: 28px 22px;
            border-radius: 12px;
        }

        .modal-title {
            font-size: 2.25rem;
        }

        .modal-body {
            font-size: 1rem;
        }
    }

    @media (max-width: 960px) {
        .options-grid {
            grid-template-columns: 1fr;
            grid-template-rows: repeat(4, 1fr);
            gap: 8px;
        }

        .quiz-title {
            font-size: 1.6rem;
        }

        .question-text {
            font-size: 1.125rem;
            padding: 14px;
        }

        .timer-pill {
            right: 12px;
            top: 10px;
        }

        .qr-inline-image {
            width: 196px;
            height: 196px;
        }

        .option-button {
            padding: 22px 16px;
        }

        .option-image {
            max-width: 36%;
        }
    }

    @media (max-width: 480px) {
        .quiz-container {
            height: calc(100vh - 80px);
        }

        .options-grid {
            gap: 8px;
        }

        .qr-inline-image {
            width: 134px;
            height: 134px;
        }

        .option-image {
            max-width: 34%;
        }

        .option-index {
            min-width: 52px;
            height: 52px;
        }
    }

    .loading {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        font-size: 1.5rem;
        color: #fff;
        background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    }
}
</style>
