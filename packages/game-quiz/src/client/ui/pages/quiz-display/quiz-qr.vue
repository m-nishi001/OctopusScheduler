<template>
    <DisplayStage>
        <template #title>このQRコードを読み込んでください！</template>
        <img v-if="qrCodeUrl" :src="qrCodeUrl" alt="QR Code" class="qr-image" />
        <p v-else-if="errorMessage">{{ errorMessage }}</p>
        <template #hint>Enterで次へ進みます</template>
    </DisplayStage>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import DisplayStage from '../../components/display/display-stage.vue';
import { useParticipantJoinUrl } from '../../composables/use-participant-join-url';
import { useQuizSession } from '../../composables/use-quiz-session';

const router = useRouter();
const route = useRoute();

const quizId = route.params.id as string;

const session = useQuizSession();

// QR表示はセッション開始なので、トークンを切り替えて以前のURLを無効にする。
const { joinUrl, errorMessage } = useParticipantJoinUrl(quizId, session, { rotate: true });

const qrCodeUrl = computed(() => {
    if (!joinUrl.value) return '';
    return `https://api.qrserver.com/v1/create-qr-code/?size=800x800&margin=2&data=${encodeURIComponent(joinUrl.value)}`;
});

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        router.push({ name: session.routeName('quiz-play'), params: { id: quizId } });
    }
};

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
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
</style>
