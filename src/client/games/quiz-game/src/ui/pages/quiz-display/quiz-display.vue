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
            <!-- Two-column header: QR on the left, boxed title/content on the right -->
            <div class="header-row">
                <div class="qr-inline" aria-hidden="false">
                    <img :src="qrCodeUrl" alt="QR Code" class="qr-image qr-inline-image" />
                </div>
                <div class="header-content">
                    <div class="title-card" aria-hidden="false">
                        <h1 class="quiz-title">{{ quiz.title }}</h1>
                        <!-- (removed duplicate small title) -->
                        <!-- show the full question text in the boxed header area -->
                        <p class="quiz-content">{{ quiz.question }}</p>
                    </div>
                </div>
            </div>
        </header>

        <!-- 質問エリア: 質問テキストはヘッダの boxed area に移動した -->
        <section class="question-area" aria-live="polite">

            <!-- 選択肢タイル -->
            <div class="options-grid" role="list">
                <div v-for="(option, index) in quiz.options" :key="index" role="listitem">
                    <button class="option-button" :style="{ '--option-color': option.color }"
                        @click="selectOption(index)" :aria-label="option.text">
                        <div class="image-wrapper">
                            <!-- show image if provided; image fills the tile -->
                            <img v-if="option.image" :src="option.image" :alt="option.text" class="option-image" />

                            <!-- number badge (overlay) -->
                            <div class="option-index">{{ index + 1 }}</div>

                            <!-- text ribbon at bottom -->
                            <div class="text-ribbon" aria-hidden="false">
                                <span class="option-text">{{ option.text }}</span>
                            </div>
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

/* .quiz-subtitle removed — no longer used (duplicate of .quiz-title) */

.quiz-preview {
    margin: 0;
    color: var(--muted);
    opacity: 0.95;
    font-size: 1rem;
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

.quiz-content {
    background: transparent;
    margin: 0;
    font-size: 1.375rem;
    color: var(--muted);
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
    padding: 0;
    height: 100%;
    /* fill grid cell */
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
    /* reduce QR size so header uses less vertical space on desktop */
    width: 168px;
    height: 168px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
}

.qr-image {
    /* keep class for legacy uses */
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
    /* make dialog larger and more prominent */
    width: min(820px, 86%);
    max-width: 920px;
    /* increase vertical space: larger min-height and more vertical padding */
    min-height: 260px;
    padding: 56px 56px;
    border-radius: 16px;
    color: white;
    /* center content vertically and horizontally */
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

/* Responsive: ensure modal fits smaller viewports */
@media (max-width: 640px) {
    .modal-card {
        width: calc(100% - 40px);
        /* smaller vertical size on mobile but still taller than before */
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
</style>