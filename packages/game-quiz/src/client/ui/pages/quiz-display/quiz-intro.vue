<template>
    <DisplayStage>
        <p class="announcement-text">これからクイズが始まります！！</p>
        <template #hint>Enterキーを押して次へ</template>
    </DisplayStage>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { container } from 'tsyringe';
import DisplayStage from '../../components/display/display-stage.vue';
import { useQuizSession } from '../../composables/use-quiz-session';
import { StopAcceptingAnswersUseCase } from '../../../control/use-cases/stop-accepting-answers-use-case';

const router = useRouter();
const route = useRoute();

const quizId = route.params.id as string;
const session = useQuizSession();

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        router.push({ name: session.routeName('quiz-qr'), params: { id: quizId } });
    }
};

onMounted(() => {
    // 前回の実行で受付中のまま離脱していても、開始前に回答できないよう受付を止めておく。
    container.resolve(StopAcceptingAnswersUseCase).execute(quizId, session.scope)
        .catch((e) => console.error('Failed to reset acceptance', e));
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.announcement-text {
    margin: 0;
    padding: clamp(24px, 6vmin, 80px) clamp(24px, 8vmin, 120px);
    font-size: clamp(2rem, 8vmin, 7rem);
    font-weight: 800;
    line-height: 1.25;
    color: var(--stage-gold, #ffd54a);
    background: var(--stage-card, rgba(17, 24, 39, 0.65));
    border-radius: clamp(12px, 2vmin, 28px);
    box-shadow: 0 12px 40px rgba(2, 6, 23, 0.6);
    max-width: 100%;
    box-sizing: border-box;
}
</style>
