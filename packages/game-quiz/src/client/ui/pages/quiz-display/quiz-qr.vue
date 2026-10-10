<template>
    <DisplayStage>
        <template #title>このQRコードを読み込んでください！</template>
        <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="qr-image" />
        <p v-else-if="notHost" class="qr-note">
            セッションのホストとして接続していません。管理画面の「セッション」から、この端末をホストとして開いてください。
        </p>
        <p v-else-if="errorMessage">{{ errorMessage }}</p>
        <p v-if="portal" class="qr-code" aria-label="参加コード">参加コード {{ portal.code }}</p>
        <template #hint>Enterで次へ進みます</template>
    </DisplayStage>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed, ref } from 'vue';
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

// 参加者が読み取るのは、このセッションの参加ポータル(参加コード入り)。
const portal = ref<{ url: string; code: string } | null>(null);
const errorMessage = ref<string | null>(null);
const notHost = computed(() => !gateway.isActive());

const qrCodeUrl = computed(() => {
    if (!portal.value) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=2&data=${encodeURIComponent(portal.value.url)}`;
});

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
    try {
        portal.value = await gateway.portalUrl();
    } catch (e) {
        errorMessage.value = e instanceof Error ? e.message : String(e);
    }
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
/* 本文領域(タイトル・ヒントを除いた残り)に収まる最大の正方形。遠くからでも読み取れる大きさにする。 */
.qr-image {
    width: min(100cqw, 100cqh);
    height: auto;
    aspect-ratio: 1 / 1;
    background: #fff;
    padding: clamp(8px, 1.6vmin, 24px);
    box-sizing: border-box;
    border-radius: clamp(8px, 1.6vmin, 20px);
    box-shadow: 0 12px 40px rgba(2, 6, 23, 0.6);
}

.qr-code {
    margin: 0;
    font-size: clamp(1rem, 3vmin, 2rem);
    font-weight: 800;
    letter-spacing: 0.2em;
    color: #ffd54a;
}

.qr-note {
    max-width: 40em;
    line-height: 1.7;
    opacity: 0.85;
}
</style>
