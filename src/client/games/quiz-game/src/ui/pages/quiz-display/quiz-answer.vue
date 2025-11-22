<template>
  <div v-if="quiz" class="answer-container">
    <header class="answer-header">
      <h1 class="answer-title">クイズの回答はこちら！！</h1>
    </header>
    <main class="answer-main">
      <div class="answer-card">
        <OptionCard v-if="correctOption" :option="correctOption" :index="correctIndex" variant="large" />
        <div v-else class="no-answer">正解が設定されていません。</div>
      </div>
    </main>
  </div>
  <div v-else class="loading">Loading...</div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import OptionCard from '../../components/option-card.vue';
import { onUnmounted } from 'vue';
import type { QuizDto } from '../../../../model/applications/dtos/quiz-dto';
import { StartQuizUseCase } from '../../../../model/applications/use-cases/start-quiz-use-case';

const route = useRoute();
const router = useRouter();
const quizId = route.params.id as string;
const quiz = ref<QuizDto | null>(null);

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
});

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown);
});

const handleKeydown = (ev: KeyboardEvent) => {
  if (ev.key === 'Enter') {
    router.push(`/quiz-result/${quizId}`);
  }
};
</script>

<style scoped>
.answer-container {
  min-height: 100vh;
  background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
  color: white;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px;
}
.answer-title {
  font-size: 2rem;
  font-weight: 800;
  color: #ffd54a;
  margin: 16px 0 24px 0;
}
.answer-main {
  width: 100%;
  max-width: 960px;
  display: flex;
  justify-content: center;
}
.answer-card {
  width: 100%;
}
.no-answer {
  color: #f97316;
  text-align: center;
  font-weight: 700;
}
</style>
