<template>
    <DisplayStage>
        <template #title>このQRコードを読み込んでください！</template>
        <img :src="qrCodeUrl" alt="QR Code" class="qr-image" />
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

const { joinUrl } = useParticipantJoinUrl(quizId, session);

const qrCodeUrl = computed(() => {
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
/* 本文領域(タイトル・ヒントを除いた残り)いっぱいの正方形。遠くからでも読み取れる大きさにする。 */
.qr-image {
    height: 100%;
    max-width: 100%;
    aspect-ratio: 1 / 1;
    object-fit: contain;
    background: #fff;
    padding: clamp(8px, 1.6vmin, 24px);
    box-sizing: border-box;
    border-radius: clamp(8px, 1.6vmin, 20px);
    box-shadow: 0 12px 40px rgba(2, 6, 23, 0.6);
}
</style>
