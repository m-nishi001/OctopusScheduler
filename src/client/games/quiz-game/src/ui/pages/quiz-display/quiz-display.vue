<template>
    <!-- Simplified: use .quiz-container as the single root so content can take full viewport -->
    <div class="quiz-container">

        <!-- 残り時間表示 -->
        <div class="timer-pill" :class="{ 'urgent': timeLeft <= 10 }" aria-hidden="false">
            <span class="time">{{ timeLeft }}</span>
            <span class="unit">秒</span>
        </div>

        <!-- タイトル（QRを左に配置して上部領域を節約） -->
        <header class="quiz-header">
            <div class="qr-inline" aria-hidden="false">
                <img :src="qrCodeUrl" alt="QR Code" class="qr-image qr-inline-image" />
            </div>
            <h1 class="quiz-title">{{ quiz.title }}</h1>
        </header>

        <!-- 質問 -->
        <section class="question-area" aria-live="polite">
            <p class="question-text">{{ quiz.question }}</p>

            <!-- 選択肢タイル -->
            <div class="options-grid" role="list">
                <div v-for="(option, index) in quiz.options" :key="index" role="listitem">
                    <button class="option-button" :style="{ '--option-color': option.color }"
                        @click="selectOption(index)" :aria-label="option.text">
                        <div class="option-content">
                            <div class="option-index">{{ index + 1 }}</div>
                            <!-- show image if provided -->
                            <img v-if="option.image" :src="option.image" alt="" class="option-image" />
                            <div class="option-text">{{ option.text }}</div>
                        </div>
                    </button>
                </div>
            </div>
        </section>

        <!-- Modal for time up -->
        <div v-if="showModal" class="modal-overlay" role="dialog" aria-modal="true">
            <div class="modal-card">
                <h2 class="modal-title">終了！</h2>
                <p class="modal-body">回答時間が終了しました。</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;

// Mock quiz data
const quiz = ref({
    title: 'クイズ ' + quizId,
    question: 'これはサンプルの質問です？',
    options: [
        { text: 'はい', color: '#ff0000', image: '' },
        { text: 'いいえ', color: '#00ff00', image: '' },
        { text: 'わからない', color: '#0000ff', image: '' },
        { text: 'どちらでも', color: '#ffff00', image: '' },
    ],
    answerUrl: 'https://example.com/answer',
    timeLimit: 30, // seconds
});

const timeLeft = ref(quiz.value.timeLimit);
const showModal = ref(false);
// setInterval can return different types depending on DOM vs Node typings.
// Use ReturnType<typeof setInterval> to be compatible across environments.
let timer: ReturnType<typeof setInterval> | undefined;

const qrCodeUrl = ref(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(quiz.value.answerUrl)}`);

onMounted(() => {
    startTimer();
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('keydown', handleKeydown);
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
</script>

<!-- Global (non-scoped) rules: hide visible scrollbars but keep ability to scroll if needed -->
<style>
/* hide scrollbar across browsers while preserving scroll behaviour */
html,
body,
#app {
    height: 100%;
}

/* Firefox */
body {
    -ms-overflow-style: none;
    /* IE and Edge */
    scrollbar-width: none;
    /* Firefox */
}

/* WebKit */
body::-webkit-scrollbar {
    width: 0;
    height: 0;
}
</style>

<style scoped>
:root {
    --card-bg: rgba(17, 24, 39, 0.65);
    /* slate-900 65% */
    --muted: rgba(255, 255, 255, 0.85);
}

.quiz-container {
    /* Full-bleed root container: take full viewport so content can be larger */
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    border-radius: 0;
    /* full-bleed, no outer rounded card */
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    /* moved background here */
    color: #fff;
    display: flex;
    flex-direction: column;
    position: relative;
}

.quiz-header {
    text-align: center;
    margin-bottom: 18px;
}

.quiz-title {
    font-size: 2.25rem;
    /* ~36px */
    font-weight: 800;
    color: #ffd54a;
    /* soft yellow */
    margin: 0;
    letter-spacing: 0.02em;
}

.timer-pill {
    position: absolute;
    top: 14px;
    right: 18px;
    background: rgba(255, 255, 255, 0.06);
    color: var(--muted);
    /* larger pill to be more visible */
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
    /* let question-area grow so the options-grid inside can expand to fill the lower space */
    flex: 1 1 auto;
}

.question-text {
    background: var(--card-bg);
    display: inline-block;
    padding: 18px 22px;
    border-radius: 12px;
    font-size: 1.375rem;
    /* 22px */
    margin-bottom: 12px;
    max-width: 900px;
    flex: 0 0 auto;
    /* keep the question block from stretching */
}

.options-grid {
    /* Make the grid content-driven and responsive: auto-fit columns, sensible min width,
       and row heights that can grow but have a reasonable minimum. Align content to start
       so leftover space is placed below the grid (avoids big bottom gaps). */
    flex: 1 1 auto;
    min-height: 0;
    /* ensure flex children can shrink correctly */
    display: grid;
    /* Force 2 columns on desktop/tablet to avoid 3-column layout on wide screens */
    grid-template-columns: repeat(2, minmax(360px, 1fr));
    /* Let rows expand equally to fill available vertical space so options use the lower area */
    grid-auto-rows: 1fr;
    gap: clamp(8px, 1.2vw, 20px);
    margin-top: 0px;
    align-items: stretch;
    align-content: stretch;
}

.option-button {
    --bg: var(--option-color, #334155);
    width: 100%;
    padding: 24px 18px;
    height: 100%;
    /* fill grid cell */
    border-radius: 16px;
    border: none;
    cursor: pointer;
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.06)), var(--bg);
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.55);
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
    font-weight: 900;
    text-align: left;
}

.option-button:active {
    transform: translateY(2px) scale(0.998);
}

.option-button:hover {
    transform: translateY(-6px);
    filter: brightness(1.03);
}

.option-content {
    display: flex;
    gap: 24px;
    align-items: center;
}

.option-image {
    /* size relative to the option cell so images scale with available space */
    max-width: 40%;
    max-height: 70%;
    width: auto;
    height: auto;
    object-fit: cover;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.5);
}

.option-index {
    /* scale badge size with viewport but clamp to sensible values */
    min-width: clamp(56px, 7vw, 120px);
    height: clamp(56px, 7vw, 120px);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.12);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.05rem;
}

.option-text {
    font-size: clamp(1.25rem, 3.2vw, 2rem);
}

.qr-inline {
    display: flex;
    align-items: center;
    margin-right: 16px;
}

.qr-inline-image {
    /* reduce QR size so header uses less vertical space on desktop */
    width: 120px;
    height: 120px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
}

.qr-image {
    /* keep class for legacy uses */
    width: 120px;
    height: 120px;
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
    padding: 28px 36px;
    border-radius: 14px;
    color: white;
    text-align: center;
    box-shadow: 0 20px 60px rgba(2, 6, 23, 0.6);
}

.modal-title {
    font-size: 2rem;
    margin: 0 0 8px 0;
}

.modal-body {
    font-size: 1rem;
}

/* small screens */
@media (max-width: 960px) {

    /* tablet and below: switch to single column for options to give them more width */
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
        width: 140px;
        height: 140px;
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
        width: 96px;
        height: 96px;
    }

    .option-image {
        max-width: 34%;
    }

    .option-index {
        min-width: 52px;
        height: 52px;
    }
}
</style>