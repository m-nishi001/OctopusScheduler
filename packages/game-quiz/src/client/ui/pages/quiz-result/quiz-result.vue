<template>
    <div>
        <div class="full-screen-particles" v-if="showFullScreenParticles">
            <div class="full-particle" v-for="i in 100" :key="i"
                :style="{ '--delay': i * 0.01 + 's', '--x': Math.random() * 100 + 'vw', '--y': Math.random() * 100 + 'vh', '--dx': (Math.random() - 0.5) * 400 + 'px', '--dy': (Math.random() - 0.5) * 400 + 'px', '--color': ['#ffd700', '#ff4500', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#ff1493', '#00ffff'][i % 8] }">
            </div>
        </div>
        <div class="result-table-container">
            <h1 class="title text-3xl font-bold text-center mb-6">結果表示！</h1>
            <div v-if="isLoadingResults" class="loading-state" aria-live="polite">
                <div class="spinner" aria-hidden="true"></div>
                <p>集計中...</p>
            </div>
            <transition-group v-else name="ranking" tag="div" class="ranking-list">
                <div v-for="(record, idx) in displayedResults" :key="record.userId || (record.displayName + '-' + idx)"
                    class="ranking-item"
                    :class="[{ 'first-place': record.rank === 1 }, `rank-${Math.min(record.rank, 4)}`]">
                    <div class="rank-badge">{{ record.rank }}</div>
                    <div class="player-info">
                        <div class="player-name">{{ record.displayName }}</div>
                        <div class="player-time">{{ formatTime(record.timeToAnswerSec) }}</div>
                    </div>
                    <div v-if="record.rank === 1" class="cracker-particles">
                        <div class="particle" v-for="i in 50" :key="i"
                            :style="{ '--delay': i * 0.02 + 's', '--angle': Math.random() * 360 + 'deg', '--color': ['#ffd700', '#ff4500', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#ff1493', '#00ffff'][i % 8] }">
                        </div>
                    </div>
                </div>
            </transition-group>
        </div>
        <PrizeDialog :visible="isPrizeDialogVisible" :prize-name="prizeName" :prize-image-url="prizeImageUrl"
            @close="hidePrizeDialog" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { StartQuizUseCase } from '../../../control/use-cases/start-quiz-use-case';
import { GetAcceptanceStateUseCase } from '../../../control/use-cases/get-acceptance-state-use-case';
import { GetSubmittedAnswersUseCase } from '../../../control/use-cases/get-submitted-answers-use-case';
import { computeRanking } from '../../../model/ranking';
import type { RankedResult } from '../../../model/ranking';
import type { QuizDto } from '../../../control/dto/quiz-dto';
import PrizeDialog from '../../components/prize-dialog.vue';
import { usePrizeOrchestrator } from '../../composables/use-prize-orchestrator';
import { useRankingReveal } from '../../composables/use-ranking-reveal';

const router = useRouter();
const route = useRoute();

type DisplayResult = RankedResult & { rank: number };

const finalResults = ref<DisplayResult[]>([]);
const currentQuiz = ref<QuizDto | null>(null);
const isLoadingResults = ref(true);

const {
    displayedResults,
    showCelebration: showFullScreenParticles,
    isFinished: rankingFinished,
    reveal: revealRanking,
} = useRankingReveal<DisplayResult>();

const { isPrizeDialogVisible, showPrizeDialog, hidePrizeDialog } = usePrizeOrchestrator({
    getSettings: () => currentQuiz.value?.settings,
    onNavigateHome: () => router.push({ path: '/quiz-home' }),
});

const prizeName = computed(() => currentQuiz.value?.settings?.prizeName || null);
const prizeImageUrl = ref<string | null>(null);

// update prizeImageUrl whenever currentQuiz changes
watch(currentQuiz, (q: QuizDto | null) => {
    try {
        if (prizeImageUrl.value && prizeImageUrl.value.startsWith('blob:')) {
            URL.revokeObjectURL(prizeImageUrl.value);
        }
    } catch (e) {
        // ignore
    }
    const p = q?.settings?.prizeImage;
    if (p instanceof Blob) {
        try {
            prizeImageUrl.value = URL.createObjectURL(p);
        } catch (e) {
            prizeImageUrl.value = null;
        }
    } else if (typeof p === 'string') {
        prizeImageUrl.value = p;
    } else {
        prizeImageUrl.value = null;
    }
});

function formatTime(seconds: number | null): string {
    if (seconds === null || typeof seconds !== 'number' || Number.isNaN(seconds)) return '-';
    const negative = seconds < 0;
    const abs = Math.abs(seconds);
    const mins = Math.floor(abs / 60);
    const secs = abs - mins * 60;
    // Always show milliseconds precision up to 3 decimal places
    const secsStr = secs.toFixed(3);
    if (mins > 0) {
        const body = `${mins}分${secsStr}秒`;
        return negative ? `-${body}` : body;
    }
    const body = `${secsStr}秒`;
    return negative ? `-${body}` : body;
}

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
    (async () => {
        const quizId = route.params.id as string;
        try {
            const startQuizUseCase = container.resolve(StartQuizUseCase);
            const getAcceptanceStateUseCase = container.resolve(GetAcceptanceStateUseCase);
            const getSubmittedAnswersUseCase = container.resolve(GetSubmittedAnswersUseCase);

            const [quiz, acceptanceState, answers] = await Promise.all([
                startQuizUseCase.execute(quizId),
                getAcceptanceStateUseCase.execute(quizId),
                getSubmittedAnswersUseCase.execute(quizId),
            ]);

            currentQuiz.value = quiz;
            const ranked = computeRanking(answers, {
                correctNo: quiz?.correctNo ?? 1,
                acceptStartedAtMs: acceptanceState.acceptStartedAtMs,
            });
            finalResults.value = ranked.map((result, idx) => ({ ...result, rank: idx + 1 }));
        } catch (e) {
            console.error('Failed to prepare quiz results', e);
            currentQuiz.value = null;
            finalResults.value = [];
        }
        isLoadingResults.value = false;
        await revealRanking(finalResults.value);
    })();
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
    try {
        if (prizeImageUrl.value && prizeImageUrl.value.startsWith('blob:')) {
            URL.revokeObjectURL(prizeImageUrl.value);
        }
    } catch (e) {
        // ignore
    }
});

function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        if (isPrizeDialogVisible.value) {
            // Let orchestrator handle it
            return;
        }
        // If ranking animation finished, Enter shows prize dialog
        if (rankingFinished.value) {
            if (!isPrizeDialogVisible.value) {
                showPrizeDialog();
            }
            return;
        }
    }
}

</script>

<style scoped>
.result-table-container {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    border-radius: 0;
    background: #000;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    position: relative;
}

:global(html),
:global(body) {
    overflow: hidden;
}

.title {
    position: absolute;
    top: 17px;
    left: 50%;
    transform: translateX(-50%);
    margin: 0;
}

.loading-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 1.1rem;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 4px solid rgba(255, 255, 255, 0.15);
    border-top-color: #ffd700;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.ranking-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    max-width: 600px;
}

.ranking-item {
    display: flex;
    align-items: center;
    gap: 16px;
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 14px;
    padding: 14px 18px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    transform: translateX(0);
    opacity: 1;
}

.ranking-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.ranking-enter-active {
    transition: all 0.5s ease;
}

.ranking-item.rank-3 {
    border-color: rgba(205, 127, 50, 0.5);
}

.ranking-item.rank-2 {
    border-color: rgba(200, 200, 200, 0.6);
}

.ranking-item.rank-1 {
    border-color: rgba(255, 215, 0, 0.7);
    background: linear-gradient(90deg, rgba(255, 215, 0, 0.16), rgba(255, 215, 0, 0.04));
}

.ranking-item.first-place {
    position: relative;
    animation: firstPlaceGlow 1.6s ease-in-out infinite alternate;
}

@keyframes firstPlaceGlow {
    0% {
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 10px rgba(255, 215, 0, 0.25);
    }

    100% {
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 28px rgba(255, 215, 0, 0.55);
    }
}

.cracker-particles {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 0;
    height: 0;
    pointer-events: none;
}

.particle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: radial-gradient(circle, var(--color), transparent);
    border-radius: 50%;
    animation: crackerBurst 2s ease-out var(--delay) forwards;
}

@keyframes crackerBurst {
    0% {
        transform: scale(0) translate(0, 0) rotate(0deg);
        opacity: 1;
    }

    50% {
        opacity: 1;
        transform: scale(1.5) translate(calc(100px * cos(var(--angle))), calc(100px * sin(var(--angle)))) rotate(180deg);
    }

    100% {
        transform: scale(1) translate(calc(200px * cos(var(--angle))), calc(200px * sin(var(--angle)))) rotate(360deg);
        opacity: 0;
    }
}

.full-screen-particles {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
    z-index: 1000;
}

.full-particle {
    position: absolute;
    left: var(--x);
    top: var(--y);
    width: 12px;
    height: 12px;
    background: radial-gradient(circle, var(--color), transparent);
    border-radius: 50%;
    animation: fullScreenBurst 2s ease-out var(--delay) forwards;
}

@keyframes fullScreenBurst {
    0% {
        transform: scale(0) translate(0, 0) rotate(0deg);
        opacity: 1;
    }

    50% {
        transform: scale(1.5) translate(0, 0) rotate(180deg);
        opacity: 1;
    }

    100% {
        transform: scale(1) translate(var(--dx), var(--dy)) rotate(360deg);
        opacity: 0;
    }
}

.rank-badge {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 44px;
    height: 44px;
    border-radius: 50%;
    font-size: 1.15rem;
    font-weight: 800;
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
}

.rank-1 .rank-badge {
    background: linear-gradient(145deg, #ffe27a, #d4a017);
    color: #3a2900;
    box-shadow: 0 0 14px rgba(255, 215, 0, 0.6);
}

.rank-2 .rank-badge {
    background: linear-gradient(145deg, #e8e8e8, #a8a8a8);
    color: #2b2b2b;
}

.rank-3 .rank-badge {
    background: linear-gradient(145deg, #e3ac72, #ad6a2e);
    color: #2b1400;
}

.player-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.player-name {
    font-size: 1.15rem;
    font-weight: 700;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.player-time {
    font-size: 0.9rem;
    color: rgba(255, 255, 255, 0.65);
    font-variant-numeric: tabular-nums;
}

.rank-1 .player-name {
    color: #fff8e1;
}

@media (max-width: 600px) {
    .result-table-container {
        padding: 20px 16px;
    }

    .title {
        font-size: 1.5rem;
    }

    .ranking-item {
        padding: 12px 14px;
        gap: 12px;
    }

    .rank-badge {
        min-width: 36px;
        height: 36px;
        font-size: 1rem;
    }

    .player-name {
        font-size: 1rem;
    }

    .player-time {
        font-size: 0.8rem;
    }
}
</style>