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
            <div class="options-grid" :class="{ 'two-options': optionsCount === 2 }" role="list">
                <OptionCard v-for="(option, index) in optionsWithImageUrls" :key="index" :option="option" :index="index"
                    @select="selectOption" :style="{ '--option-color': option.color }" />
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
import { AnswerFormService } from '../../../model/domains/services/answer-form-service';
import OptionCard from '../../components/option-card.vue';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;

const quiz = ref<QuizDto | null>(null);

const timeLeft = ref(0);
const showModal = ref(false);
let timer: ReturnType<typeof setInterval> | undefined;
const objectUrls = ref<string[]>([]);
const audioElement = ref<HTMLAudioElement | null>(null);

const qrCodeUrl = computed(() => {
    if (!quiz.value) return '';
    const q = quiz.value as QuizDto;
    return `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(q.answerUrl)}`;
});

const isPreview = computed(() => route.query.preview === 'true');

const optionsWithImageUrls = computed((): { no: number; text: string; color: string; imageUrl: string }[] => {
    if (!quiz.value) return [];
    return quiz.value.options.map((option, index) => {
        const imageUrl = (objectUrls.value[index] || (option.image instanceof Blob ? URL.createObjectURL(option.image) : option.image || '')) as string;
        return {
            no: option.no,
            text: option.text,
            color: option.color,
            imageUrl,
        };
    });
});

const optionsCount = computed(() => optionsWithImageUrls.value.length);

onMounted(async () => {
    const startQuizUseCase = container.resolve(StartQuizUseCase);
    quiz.value = await startQuizUseCase.execute(quizId);
    if (quiz.value) {
        timeLeft.value = quiz.value.timeLimit;
        startTimer();
        // Create object URLs for images
        objectUrls.value = quiz.value.options.map(option => {
            if (option.image instanceof Blob) {
                return URL.createObjectURL(option.image);
            }
            return (option.image as string) || '';
        });
        // Play BGM if available
        if (quiz.value.bgm) {
            const audio = new Audio();
            if (quiz.value.bgm instanceof Blob) {
                audio.src = URL.createObjectURL(quiz.value.bgm);
            } else {
                audio.src = quiz.value.bgm as string;
            }
            audio.loop = true;
            audio.play().catch(console.error); // 再生失敗を無視
            audioElement.value = audio;
        }
    }
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('keydown', handleKeydown);
    // Revoke object URLs to prevent memory leaks
    objectUrls.value.forEach(url => {
        if (url.startsWith('blob:')) {
            URL.revokeObjectURL(url);
        }
    });
    // Stop BGM
    if (audioElement.value) {
        audioElement.value.pause();
        audioElement.value = null;
    }
});

const startTimer = () => {
    timer = setInterval(() => {
        timeLeft.value--;
        if (timeLeft.value <= 0) {
            if (timer) clearInterval(timer);
            // Stop BGM
            if (audioElement.value) {
                audioElement.value.pause();
                audioElement.value = null;
            }
            showModal.value = true;
            const answerFormService = container.resolve(AnswerFormService);
            answerFormService.stopForm(quizId);
        }
    }, 1000);
};

const selectOption = (index: number) => {
    console.log('Selected option:', index);
};

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && showModal.value) {
        if (audioElement.value) {
            audioElement.value.pause();
            audioElement.value = null;
        }
        router.push(`/quiz/${quizId}/answer?preview=${isPreview.value}`);
    }
};
</script>
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
    width: 100%;
    /* avoid 100vw + padding overflow */
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
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
    flex: 1;
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

.quiz-title {
    font-size: 2.25rem;
    font-weight: 800;
    color: #ffd54a;
    margin: 0;
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
    transition: transform .18s ease, background-color .18s ease;
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
    font-size: .75rem;
    opacity: .85;
}

.question-area {
    text-align: center;
    margin-bottom: 6px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
}

.quiz-content {
    margin: 0;
    font-size: 1.375rem;
    color: var(--muted);
}

/* Grid: always 2 columns (2 x N rows). Narrow screens keep 2 columns as requested. */
.options-grid {
     display: grid;
     /* Always use 2 columns to keep the layout consistent (2 columns x N rows).
         Columns share available space equally. */
     grid-template-columns: repeat(2, 1fr);
    gap: clamp(12px, 1.2vw, 24px);
    align-items: stretch;
    align-content: stretch;
    justify-items: stretch;
    /* Reduce vertical footprint so two rows fit without overflowing. */
    /* Ensure rows expand to fill available area but avoid becoming too small. */
    grid-auto-rows: minmax(120px, 1fr);
    /* allow rows to be smaller when space is constrained */
    height: 100%;
    /* fill parent (.question-area) which is flex:1 */
    /* Use flex growth so this grid reliably fills the remaining vertical space
       even if header size changes. */
    flex: 1 1 auto;
}

.options-grid.two-options {
    grid-template-rows: 1fr;
    grid-auto-rows: unset;
}

/* When exactly two options are present, make each grid cell and its button fill the
   available height so the two options occupy the full area (no bottom gap). */
.options-grid.two-options>div {
    display: flex;
    align-items: stretch;
}

.options-grid.two-options .option-button {
    /* let the button stretch to full height of the grid cell */
    height: 100%;
    display: flex;
    flex-direction: column;
}

/* Remove the fixed aspect-ratio for image-wrapper in two-option layout so images
   can expand vertically to fill the card. */
.options-grid.two-options .image-wrapper {
    aspect-ratio: auto;
    height: 100%;
    min-height: 0;
    /* allow shrinking inside flex */
}

.options-grid.two-options .option-image {
    object-fit: cover;
    /* better visual fill when expanding */
    height: 100%;
}

.option-button {
    width: 100%;
    padding: 0;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    color: #fff;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.06));
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.55);
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
    font-weight: 900;
    text-align: left;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
}

.option-button:active {
    transform: translateY(2px) scale(.998);
}

.option-button:hover {
    transform: translateY(-6px);
    filter: brightness(1.03);
}

.image-wrapper {
    position: relative;
    width: 100%;
    display: block;
    overflow: hidden;
    border-radius: 16px;
    aspect-ratio: 11/5;
    background: var(--option-color, #334155);
}

.option-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    transform-origin: center;
    transition: transform 250ms ease;
    background-color: transparent;
}

.option-button:hover .option-image {
    transform: scale(1.02);
}

.option-index {
    position: absolute;
    top: 12px;
    left: 12px;
    min-width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--option-color, rgba(255, 255, 255, 0.12));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.05rem;
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
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 56px);
    padding: 6px 8px;
}

.qr-inline {
    display: flex;
    align-items: center;
    margin-right: 16px;
}

.qr-inline-image,
.qr-image {
    width: 168px;
    height: 168px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
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
    padding: 56px;
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
    opacity: .98;
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

/* Responsive tweaks at root level (previously nested incorrectly) */
@media (max-width:960px) {

    /* Keep two-column layout even on narrower screens; only adjust spacing and sizes. */
    .options-grid {
        /* keep grid-template-columns as 2 columns */
        gap: 8px;
        /* allow rows to size based on content on narrow viewports */
        grid-auto-rows: auto;
        height: auto;
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

    .qr-inline-image,
    .qr-image {
        width: 196px;
        height: 196px;
    }

    .option-button {
        padding: 22px 16px;
    }

    /* keep full-width images inside option cards on narrow screens */
}

@media (max-width:480px) {
    .quiz-container {
        height: calc(100vh - 80px);
    }

    .options-grid {
        gap: 8px;
    }

    .qr-inline-image,
    .qr-image {
        width: 134px;
        height: 134px;
    }

    /* keep full-width images inside option cards on very small screens */

    .option-index {
        min-width: 52px;
        height: 52px;
    }
}
</style>

<!-- Desktop-only overrides to increase option card height and adjust images -->
<style scoped>
@media (min-width: 1024px) {
    .options-grid {
        /* Increase the minimum row height on desktop for larger cards */
        grid-auto-rows: minmax(180px, 1fr);
    }

    /* When two options are present, ensure each option has a reasonable minimum height */
    .options-grid.two-options > div {
        min-height: 360px;
    }

    .options-grid.two-options .option-button {
        min-height: 320px;
    }
}
</style>
