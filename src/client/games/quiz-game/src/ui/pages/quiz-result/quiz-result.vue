<template>
    <div>
        <div class="full-screen-particles" v-if="showFullScreenParticles">
            <div class="full-particle" v-for="i in 100" :key="i"
                :style="{ '--delay': i * 0.01 + 's', '--x': Math.random() * 100 + 'vw', '--y': Math.random() * 100 + 'vh', '--dx': (Math.random() - 0.5) * 400 + 'px', '--dy': (Math.random() - 0.5) * 400 + 'px', '--color': ['#ffd700', '#ff4500', '#00ff00', '#0000ff', '#ff00ff', '#ffff00', '#ff1493', '#00ffff'][i % 8] }">
            </div>
        </div>
        <div class="result-table-container">
            <h1 class="title text-3xl font-bold text-center mb-6">結果表示！</h1>
            <transition-group name="ranking" tag="div" class="ranking-list">
                <div v-for="record in displayedResults" :key="record.name" class="ranking-item"
                    :class="{ 'top3': getRank(record) <= 3, 'first-place': getRank(record) === 1 }">
                    <div class="rank-number">{{ getRank(record) }}</div>
                    <div class="player-name">{{ record.name }}</div>
                    <div class="player-time">{{ formatTime(record.timeSeconds) }}</div>
                    <div v-if="getRank(record) === 1" class="cracker-particles">
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
import { PrepareQuizResultsUseCase } from '../../../model/applications/use-cases/prepare-quiz-results-use-case';
import type { QuizDto } from '../../../model/applications/dtos/quiz-dto';
import PrizeDialog from '../../../components/prize-dialog.vue';
import { usePrizeOrchestrator } from '../../../composables/use-prize-orchestrator';

const router = useRouter();
const route = useRoute();

const isPreview = computed(() => {
    const paramPreview = (route.params as any)?.preview;
    if (paramPreview !== undefined) {
        if (typeof paramPreview === 'boolean') return paramPreview;
        return String(paramPreview) === 'true' || String(paramPreview) === '1';
    }
    if (String(route.name)?.endsWith('-preview')) return true;
    return false;
});

const showFullScreenParticles = ref(false);
const rankingFinished = ref(false);

const finalResults = ref<{ name: string; timeSeconds: number | null }[]>([]);
const displayedResults = ref<{ name: string; timeSeconds: number | null }[]>([]);
const currentQuiz = ref<QuizDto | null>(null);

const { isPrizeDialogVisible, showPrizeDialog, hidePrizeDialog } = usePrizeOrchestrator({
    getSettings: () => currentQuiz.value?.settings,
    onNavigateHome: () => router.push('/execute'),
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

// Helper: rank is determined by the finalResults order (ascending time)
function getRank(record: { name: string; timeSeconds: number | null }): number {
    const idx = finalResults.value.findIndex((r: { name: string; timeSeconds: number | null }) => {
        if (r.name !== record.name) return false;
        const ta = r.timeSeconds;
        const tb = record.timeSeconds;
        // null-safe equality for numeric seconds
        return (ta === null && tb === null) || (typeof ta === 'number' && typeof tb === 'number' && Math.abs(ta - tb) < 1e-6);
    });
    return idx >= 0 ? idx + 1 : finalResults.value.length;
}

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
        try {
            const uc = container.resolve(PrepareQuizResultsUseCase);
            const res = await uc.execute(route.params.id as string, isPreview.value);
            if (!res || res.error) {
                console.error('Failed to prepare quiz results', res?.error);
                currentQuiz.value = null;
                finalResults.value = [];
            } else {
                currentQuiz.value = res.quiz;
                finalResults.value = res.results || [];
            }
            await startRankingAnimation();
        } catch (e) {
            console.error('Unexpected error in mounted preparation', e);
            await startRankingAnimation();
        }
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

async function startRankingAnimation() {
    const sorted = finalResults.value || [];
    // 最下位から順に上に積み上がるように表示（存在チェックを行う）
    for (let i = sorted.length - 1; i >= 3; i--) {
        const item = sorted[i];
        if (item) {
            displayedResults.value.unshift(item);
            await new Promise(resolve => setTimeout(resolve, 500)); // 0.5秒間隔
        }
    }
    // 上位3位は特別（存在する分だけ順に出す）
    await new Promise(resolve => setTimeout(resolve, 1000)); // 1秒待つ
    const topCount = Math.min(3, sorted.length);
    let particleShown = false;
    for (let j = topCount - 1; j >= 0; j--) {
        const item = sorted[j];
        if (item) {
            displayedResults.value.unshift(item);
            // small pause between each top placement
            await new Promise(resolve => setTimeout(resolve, 1000));
            // if this is the top (first place), play full screen particles
            if (j === 0) {
                showFullScreenParticles.value = true;
                setTimeout(() => showFullScreenParticles.value = false, 3000);
                // mark that we showed particles (we will enable Enter after animations finish)
                particleShown = true;
            }
        }
    }

    // Wait for particle animation to finish (if any) before enabling Enter -> prize
    if (particleShown) {
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    rankingFinished.value = true;
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

.ranking-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: 100%;
    max-width: 600px;
}

.ranking-item {
    display: flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 10px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
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

.ranking-item.top3 {
    background: linear-gradient(90deg, #ffd700, #ffed4e);
    color: #000;
    font-weight: bold;
}

.ranking-item.first-place {
    background: linear-gradient(45deg, #ffd700, #ffed4e, #ffd700);
    color: #000;
    font-weight: bold;
    animation: firstPlaceGlow 2s ease-in-out infinite alternate, bang 1s ease forwards;
    position: relative;
}

@keyframes firstPlaceGlow {
    0% {
        box-shadow: 0 0 20px #ffd700;
    }

    100% {
        box-shadow: 0 0 40px #ffd700, 0 0 60px #ffd700;
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

.rank-number {
    font-size: 1.5rem;
    font-weight: bold;
    margin-right: 20px;
    min-width: 50px;
    text-align: center;
}

.player-name {
    flex: 1;
    font-size: 1.2rem;
}

.player-time {
    font-size: 1.2rem;
    margin-left: 20px;
}
</style>