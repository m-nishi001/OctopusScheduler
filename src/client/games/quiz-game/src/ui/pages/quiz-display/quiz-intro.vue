<template>
    <div class="intro-container">
        <div class="announcement">
            <h1 class="announcement-text">これからクイズが始まります！！</h1>
            <p class="instruction">Enterキーを押して次へ</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';

const router = useRouter();
const route = useRoute();

const quizId = route.params.id as string;

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        // If this route is a preview route, navigate to the next preview route.
        const isPreviewRoute = String(route.name)?.endsWith('-preview');
        const routeName = isPreviewRoute ? 'quiz-qr-preview' : 'quiz-qr';
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
.intro-container {
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

.announcement {
    background: rgba(17, 24, 39, 0.65);
    border-radius: 12px;
    padding: 40px;
    box-shadow: 0 12px 30px rgba(2, 6, 23, 0.5);
}

.announcement-text {
    font-size: 4rem;
    font-weight: 800;
    color: #ffd54a;
    margin: 0 0 20px 0;
    line-height: 1.2;
}

.instruction {
    font-size: 1.5rem;
    color: rgba(255, 255, 255, 0.85);
    margin: 0;
}

@media (max-width: 768px) {
    .announcement-text {
        font-size: 3rem;
    }

    .instruction {
        font-size: 1.25rem;
    }
}
</style>