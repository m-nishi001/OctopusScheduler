<template>
    <div class="quiz-result-container">
        <div class="result-modal-overlay" role="dialog" aria-modal="true">
            <div class="result-modal-card">
                <h2 class="result-modal-title">結果</h2>
                <div v-if="currentStage === 0" class="stage-content">
                    <p class="result-body">集計完了。Enterで正解表示</p>
                </div>
                <div v-else-if="currentStage === 1" class="stage-content">
                    <p class="result-body">正解: {{ correctAnswer }}</p>
                    <p class="result-body">Enterで結果表示</p>
                </div>
                <div v-else-if="currentStage === 2" class="stage-content">
                    <p class="result-body">結果:</p>
                    <ul class="results-list">
                        <li v-for="result in results.slice(0, 10)" :key="result.rank">
                            {{ result.rank }}位: {{ result.playerName || '匿名' }} - {{ Math.round(result.time / 1000) }}秒
                        </li>
                    </ul>
                    <p class="result-body">Enterで景品へ</p>
                </div>
            </div>
        </div>
        <PrizeDialog :visible="isPrizeDialogVisible" :prize-name="prizeName" :prize-image-url="prizeImageUrl"
            @close="hidePrizeDialog" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import PrizeDialog from '../components/prize-dialog.vue';
import { usePrizeOrchestrator } from '../composables/use-prize-orchestrator';
import type { QuizDto } from '../types/quiz-dto';
import type { ResultDto } from '../types/result-dto';
import { UiQuizService } from '../services/quiz-service';
import { container } from 'tsyringe';
import { quizState } from '../../../../services/quizState';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;
const isPreview = computed(() => route.params.preview === 'true');

const quiz = ref<QuizDto | null>(null);
const results = ref<ResultDto[]>([]);
const currentStage = ref(0); // 0: initial, 1: correct shown, 2: results shown

const correctAnswer = computed(() => {
    if (!quiz.value) return '';
    const option = quiz.value.options.find(opt => opt.no === quiz.value?.correctNo);
    return option?.text || '';
});

const { isPrizeDialogVisible, showPrizeDialog, hidePrizeDialog, prizeName, prizeImageUrl } = usePrizeOrchestrator({
    getSettings: () => quiz.value?.settings,
    onNavigateHome: () => router.push({ name: 'home' }),
});

onMounted(async () => {
    // Load quiz data via DI-resolved UI service
    const quizService = container.resolve(UiQuizService) as UiQuizService;
    quiz.value = await quizService.startQuiz(quizId);
    // Load results (in preview, use dummy data)
    if (isPreview.value) {
        results.value = [
            { id: '1', playerName: 'プレビュー太郎', time: 5000, rank: 1 },
            { id: '2', playerName: 'プレビュー花子', time: 7000, rank: 2 },
        ];
    } else {
        // Try to read cached results prepared while the DLG was shown.
        const cached = quizState.getResults ? quizState.getResults() : null;
        if (cached && Array.isArray(cached) && cached.length > 0) {
            results.value = cached as any[];
            // clear cache to avoid reuse on subsequent mounts
            try {
                quizState.clearResults();
            } catch (e) {
                /* ignore */
            }
        } else {
            // In real mode and no cache: fetch actual results (fallback)
            results.value = await quizService.stopQuiz(quiz.value?.answerFormId || '', Date.now(), '回答', correctAnswer.value);
        }
    }

    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter') return;

    if (currentStage.value === 0) {
        currentStage.value = 1;
    } else if (currentStage.value === 1) {
        currentStage.value = 2;
    } else if (currentStage.value === 2) {
        showPrizeDialog();
    }
};
</script>

<style scoped>
.quiz-result-container {
    width: 100%;
    height: 100vh;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
}

.result-modal-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(2, 6, 23, 0.72);
    z-index: 60;
}

.result-modal-card {
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
}

.result-modal-title {
    font-size: 3.2rem;
    line-height: 1;
    margin: 0 0 18px 0;
}

.result-body {
    font-size: 1.25rem;
    margin: 0 0 12px 0;
    opacity: .98;
}

.results-list {
    list-style: none;
    padding: 0;
    margin: 12px 0;
    text-align: left;
}

.results-list li {
    margin-bottom: 8px;
}
</style>