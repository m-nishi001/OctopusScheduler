<template>
  <DisplayStage v-if="quiz">
    <template #title>クイズの回答はこちら！！</template>
    <OptionCard v-if="correctOption" :option="correctOption" :index="correctIndex" variant="large" />
    <div v-else class="no-answer">正解が設定されていません。</div>
    <template #hint>Enterで結果発表へ</template>
  </DisplayStage>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import OptionCard from '../../components/option-card.vue';
import DisplayStage from '../../components/display/display-stage.vue';
import { onUnmounted } from 'vue';
import type { QuizDto } from '../../../control/dto/quiz-dto';
import { StartQuizUseCase } from '../../../control/use-cases/start-quiz-use-case';
import { useAudio } from '@octopus/composables';
import { dataUrlToBlob } from '../../../model/blob-utils';
import { useQuizSession } from '../../composables/use-quiz-session';
import { useQuizHost } from '../../composables/use-quiz-host';
import { buildQuizHostState, roundKeyFor } from '../../../model/quiz-host-state';

const route = useRoute();
const router = useRouter();
const quizId = route.params.id as string;
const session = useQuizSession();
const quiz = ref<QuizDto | null>(null);
const { load, play, stop } = useAudio({ mode: 'html-audio' });
// セッションのホストなら、管理端末の「次へ」でも進める。正解はこの画面になって初めて参加者へ公開する。
const host = useQuizHost();

const correctNo = computed(() => {
  if (!quiz.value) return 1;
  // support legacy quizzes without correctNo: default to 1
  return (quiz.value as any).correctNo ?? 1;
});

const correctIndex = computed(() => Math.max(0, correctNo.value - 1));

const correctOption = computed(() => {
  if (!quiz.value || !quiz.value.options || quiz.value.options.length === 0) return null;
  return quiz.value.options[correctIndex.value] || quiz.value.options[0];
});

onMounted(async () => {
  const startQuizUseCase = container.resolve(StartQuizUseCase);
  quiz.value = await startQuizUseCase.execute(quizId);
  document.addEventListener('keydown', handleKeydown);
  host.publish(
    buildQuizHostState({
      page: 'answer',
      quizId,
      title: quiz.value?.title,
      roundKey: roundKeyFor(quizId, session.scope),
      phase: 'closed',
      question: quiz.value?.question,
      options: quiz.value?.options.map((o: any) => ({ no: o.no, text: o.text, color: o.color })) ?? [],
      correctNo: correctNo.value,
    })
  );

  // Play correct BGM if set (supports new Blob form or legacy data URL string)
  const maybeCorrect = quiz.value?.settings?.correctBgm;
  if (maybeCorrect) {
    try {
      let blobToPlay: Blob | null = null;
      if (maybeCorrect instanceof Blob) {
        blobToPlay = maybeCorrect;
      } else if (typeof maybeCorrect === 'string') {
        // legacy stored data URL; convert to Blob
        blobToPlay = dataUrlToBlob(maybeCorrect);
      }
      if (blobToPlay) {
        await load(blobToPlay);
        await play();
      }
    } catch (error) {
      console.error('Failed to play correct BGM:', error);
    }
  }
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
  stop();
});

const handleKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Enter') {
    router.push({ name: session.routeName('quiz-result'), params: { id: quizId } });
  }
};
</script>

<style scoped>
/* 正解は遠くからでも読めるよう、画面サイズに合わせて大きく表示する。 */
:deep(.option-text) {
  font-size: clamp(2rem, 7vmin, 6rem);
}

:deep(.text-ribbon) {
  padding: clamp(12px, 3vmin, 40px);
}

.no-answer {
  color: #f97316;
  font-weight: 700;
  font-size: clamp(1.25rem, 3vmin, 2.5rem);
}
</style>
