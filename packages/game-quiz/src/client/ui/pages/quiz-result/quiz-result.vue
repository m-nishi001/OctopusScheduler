<template>
    <div>
        <ResultStage :loading="isLoadingResults" :celebrating="showFullScreenParticles" :winner-name="winnerName" :no-winner="noWinner">
            <RankingBoard :rows="displayedResults" :slots="RANK_LIMIT" />
        </ResultStage>
        <PrizeDialog :visible="isPrizeDialogVisible" :prize-name="prizeName" :prize-image-url="prizeImageUrl"
            @close="hidePrizeDialog" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { StartQuizUseCase } from '../../../control/use-cases/start-quiz-use-case';
import { QuizRoundGateway } from '../../../model/quiz-round-gateway';
import { useQuizHost } from '../../composables/use-quiz-host';
import { buildQuizHostState, roundKeyFor } from '../../../model/quiz-host-state';
import { computeRanking } from '../../../model/ranking';
import type { RankedResult } from '../../../model/ranking';
import type { QuizDto } from '../../../control/dto/quiz-dto';
import PrizeDialog from '../../components/prize-dialog.vue';
import ResultStage from '../../components/result/result-stage.vue';
import RankingBoard from '../../components/result/ranking-board.vue';
import { usePrizeOrchestrator } from '../../composables/use-prize-orchestrator';
import { useRankingReveal } from '../../composables/use-ranking-reveal';
import { useQuizSession } from '../../composables/use-quiz-session';

const router = useRouter();
const route = useRoute();
const session = useQuizSession();
// セッションのホストなら、管理端末の「次へ」(順位発表→賞品)でも進める。
const host = useQuizHost();

type DisplayResult = RankedResult & { rank: number };

const finalResults = ref<DisplayResult[]>([]);
const currentQuiz = ref<QuizDto | null>(null);
const isLoadingResults = ref(true);

const {
    displayedResults,
    showCelebration: showFullScreenParticles,
    isFinished: rankingFinished,
    reveal: revealRanking,
} = useRankingReveal<DisplayResult>({}, { isCelebratable: (r) => !!r.userId });

const RANK_LIMIT = 10;
const winnerName = computed(() => {
    const first = finalResults.value[0];
    return first && first.userId ? first.displayName : '';
});

// 全員不正解(または回答なし)。順位発表が終わってから演出を出す。
const noWinner = computed(
    () => rankingFinished.value && !finalResults.value.some((r) => r.userId)
);

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

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
    (async () => {
        const quizId = route.params.id as string;
        try {
            const startQuizUseCase = container.resolve(StartQuizUseCase);
            const gateway = container.resolve(QuizRoundGateway);

            // 回答はセッション基盤が集めたもの。ホストとして接続していなければ空(= 正答者なし)になる。
            const [quiz, roundAnswers] = await Promise.all([
                startQuizUseCase.execute(quizId),
                gateway.answers(quizId, session.scope),
            ]);

            currentQuiz.value = quiz;
            host.publish(
                buildQuizHostState({
                    page: 'result',
                    quizId,
                    title: quiz?.title,
                    roundKey: roundKeyFor(quizId, session.scope),
                    phase: 'closed',
                    correctNo: quiz?.correctNo ?? 1,
                })
            );
            const ranked = computeRanking(roundAnswers?.answers ?? [], {
                correctNo: quiz?.correctNo ?? 1,
                acceptStartedAtMs: roundAnswers?.openedAtMs ?? null,
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
:global(html),
:global(body) {
    overflow: hidden;
}
</style>
