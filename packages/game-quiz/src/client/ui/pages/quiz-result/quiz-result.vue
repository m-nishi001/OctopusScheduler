<template>
    <div>
        <ResultStage :loading="isLoadingResults" :celebrating="showFullScreenParticles" :winner-name="winnerName" :no-winner="noWinner">
            <RankingBoard :rows="displayedResults" :slots="RANK_LIMIT" />
        </ResultStage>
        <PrizeDialog :visible="isPrizeDialogVisible" :prize-name="prizeName" :prize-image-url="prizeImageUrl"
            :winner-name="winnerName"
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
import { buildQuizHostState } from '../../../model/quiz-host-state';
import type { QuizRevealPhase } from '../../../model/quiz-host-state';
import { runResultRevealSequence } from '../../../model/result-reveal-sequence';
import { buildQuizRoundResult, computeRanking } from '../../../model/ranking';
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
// セッションのホストなら、管理端末の「次へ」(順位発表→賞品→ホーム)でも進める。Enter キーと同じ進行。
const host = useQuizHost({ advance: () => advance() });

type DisplayResult = RankedResult & { rank: number };

const finalResults = ref<DisplayResult[]>([]);
// 参加者ポータルの「結果」に残す内容。順位発表(演出)が終わってから保存する(ネタバレ防止)。
let pendingRecord: ReturnType<typeof buildQuizRoundResult> | null = null;
const recordResult = async () => {
    const result = pendingRecord;
    pendingRecord = null;
    if (!result) return;
    await container.resolve(QuizRoundGateway).recordResult(result);
};
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

// 終わったらホストはロビーへ戻る。管理画面(/quiz-home)へ出してはいけない。
// ホストでない場合(管理者のプレビュー)だけ、従来どおりクイズ管理へ戻る。
const goHome = () => router.push({ path: host.lobbyPath() ?? '/quiz-home' });

const { isPrizeDialogVisible, showPrizeDialog, hidePrizeDialog, confirm: confirmPrize } = usePrizeOrchestrator({
    getSettings: () => currentQuiz.value?.settings,
    onNavigateHome: goHome,
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

// この画面の間だけページのスクロールを止める。離れたら元に戻す(SPA なので、ここで止めたままにすると参加者ポータル等がスクロールできなくなる)
let restoreScroll: (() => void) | null = null;
const lockPageScroll = () => {
    const targets = [document.documentElement, document.body];
    const previous = targets.map((el) => el.style.overflow);
    targets.forEach((el) => (el.style.overflow = 'hidden'));
    restoreScroll = () => targets.forEach((el, i) => (el.style.overflow = previous[i]));
};

// 画面を離れた印。読み込みの途中で離れたら、そのあとの状態の公開(取り下げたあとの再公開)をしない。
let disposed = false;
// 順位発表の画面の状態を公開する(読み込みが済むまでは何もしない)
let publishResult: (reveal: QuizRevealPhase) => void = () => undefined;

onMounted(() => {
    lockPageScroll();
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

            if (disposed) return;
            currentQuiz.value = quiz;
            publishResult = (reveal: QuizRevealPhase) =>
                host.publish(
                    buildQuizHostState({
                        page: 'result',
                        quizId,
                        title: quiz?.title,
                        roundKey: gateway.roundKey(quizId, session.scope),
                        phase: 'closed',
                        correctNo: quiz?.correctNo ?? 1,
                        reveal,
                    })
                );
            // 発表中は順位を参加者に見せない。1位の発表と結果の保存が終わったら finished にする
            publishResult('revealing');
            if (session.scope === 'live' && roundAnswers) {
                pendingRecord = buildQuizRoundResult({
                    roundKey: gateway.roundKey(quizId, session.scope),
                    quizId,
                    title: quiz?.title ?? '',
                    correctNo: quiz?.correctNo ?? 1,
                    answers: roundAnswers.answers,
                    openedAtMs: roundAnswers.openedAtMs,
                    closedAtMs: Date.now(),
                });
            }
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
        await runResultRevealSequence({
            reveal: () => revealRanking(finalResults.value),
            record: recordResult,
            publishFinished: () => publishResult('finished'),
            isDisposed: () => disposed,
        });
    })();
});

onUnmounted(() => {
    disposed = true;
    restoreScroll?.();
    document.removeEventListener('keydown', handleKeydown);
    // 順位発表の途中で画面を離れても、結果は残す(発表を見終えるのを待たずに次の画面へ進んだ場合)
    void recordResult();
    try {
        if (prizeImageUrl.value && prizeImageUrl.value.startsWith('blob:')) {
            URL.revokeObjectURL(prizeImageUrl.value);
        }
    } catch (e) {
        // ignore
    }
});

/**
 * 「次へ」の進行。賞品のダイアログが出ていれば閉じてホームへ、順位発表が終わっていれば、
 * 当選者がいる時だけ景品を出す(いなければ景品は出さずに戻る)。発表の途中は何もしない。
 */
function advance(): void {
    if (isPrizeDialogVisible.value) confirmPrize();
    else if (rankingFinished.value) {
        if (noWinner.value) goHome();
        else showPrizeDialog();
    }
}

function handleKeydown(event: KeyboardEvent) {
    // 賞品のダイアログが出ている間の Enter は、ダイアログ側(use-prize-orchestrator)が処理する
    if (event.key === 'Enter' && !isPrizeDialogVisible.value) advance();
}

</script>
