<template>
    <DisplayStage>
        <template #title>スマホで参加者ポータルを開いてください！</template>
        <p v-if="notHost" class="qr-note">
            セッションのホストとして接続していません。管理画面の「セッション」から、この端末をホストとして開いてください。
        </p>
        <template v-else>
            <p class="qr-guide">受付でログインしたスマホの画面に、クイズが表示されます。</p>
            <p class="qr-guide">ログインしていない方は、IDとパスワードでログインしてください。</p>
        </template>
        <template #hint>Enterで次へ進みます</template>
    </DisplayStage>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { container } from 'tsyringe';
import DisplayStage from '../../components/display/display-stage.vue';
import { useQuizSession } from '../../composables/use-quiz-session';
import { useQuizHost } from '../../composables/use-quiz-host';
import { QuizRoundGateway } from '../../../model/quiz-round-gateway';
import { StartQuizUseCase } from '../../../control/use-cases/start-quiz-use-case';
import { buildQuizHostState } from '../../../model/quiz-host-state';

const router = useRouter();
const route = useRoute();

const quizId = route.params.id as string;

const session = useQuizSession();
const gateway = container.resolve(QuizRoundGateway);

const notHost = computed(() => !gateway.isActive());

const goNext = () => {
    void router.push({ name: session.routeName('quiz-play'), params: { id: quizId } });
};
const host = useQuizHost({ advance: goNext });

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') goNext();
};

onMounted(async () => {
    document.addEventListener('keydown', handleKeydown);
    try {
        const quiz = await container.resolve(StartQuizUseCase).execute(quizId);
        host.publish(buildQuizHostState({ page: 'qr', quizId, title: quiz?.title }));
    } catch {
        host.publish(buildQuizHostState({ page: 'qr', quizId }));
    }
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.qr-guide {
    margin: 0;
    max-width: 30em;
    font-size: clamp(1.2rem, 3.4vmin, 2.4rem);
    font-weight: 700;
    line-height: 1.8;
    text-align: center;
}

.qr-note {
    max-width: 40em;
    line-height: 1.7;
    opacity: 0.85;
}
</style>
