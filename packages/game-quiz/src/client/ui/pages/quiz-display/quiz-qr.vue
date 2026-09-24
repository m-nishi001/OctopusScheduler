<template>
    <div class="qr-container">
        <div class="qr-display">
            <img :src="qrCodeUrl" alt="QR Code" class="qr-large-image" />
            <p class="instruction">このQRコードを読み込んでください！</p>
            <p class="enter-hint">Enterで次へ進みます</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { buildParticipantJoinUrl } from '../../../model/participant-url';

const router = useRouter();
const route = useRoute();

const quizId = route.params.id as string;

const qrCodeUrl = computed(() => {
    const joinUrl = buildParticipantJoinUrl(quizId);
    return `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(joinUrl)}`;
});

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        // Navigate to the preview variant if this route is a preview route.
        const isPreviewRoute = String(route.name)?.endsWith('-preview');
        const routeName = isPreviewRoute ? 'quiz-play-preview' : 'quiz-play';
        router.push({ name: routeName, params: { id: quizId } });
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
.qr-container {
    width: 100%;
    height: 100vh;
    box-sizing: border-box;
    padding: 28px 32px;
    background: linear-gradient(180deg, #0f172a 0%, #0b1220 100%);
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
}

.qr-display {
    background: rgba(17, 24, 39, 0.65);
    border-radius: 12px;
    padding: 20px;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 20px;
}

.enter-hint {
    font-size: 1.1rem;
    color: #e6eef8;
    margin: 0;
}

.qr-large-image {
    width: 400px;
    height: 400px;
    border-radius: 10px;
    box-shadow: 0 8px 24px rgba(2, 6, 23, 0.55);
}

.instruction {
    font-size: 1.8rem;
    font-weight: bold;
    color: #ffd54a;
    margin: 0;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
    animation: bounce 2s infinite;
}

@keyframes bounce {

    0%,
    20%,
    50%,
    80%,
    100% {
        transform: translateY(0);
    }

    40% {
        transform: translateY(-10px);
    }

    60% {
        transform: translateY(-5px);
    }
}

@media (max-width: 768px) {
    .qr-large-image {
        width: 300px;
        height: 300px;
    }

    .instruction {
        font-size: 1.5rem;
    }
}
</style>
