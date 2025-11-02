<template>
    <div class="quiz-result flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 class="text-4xl mb-8">クイズ {{ quizId }} の結果</h1>
        <div class="mb-8">
            <h2 class="text-2xl mb-4">回答集計</h2>
            <div class="grid grid-cols-2 gap-4">
                <div v-for="(option, index) in results" :key="index" class="result-item p-4 rounded-lg"
                    :style="{ backgroundColor: option.color }">
                    <p>{{ option.text }}: {{ option.votes }} 票</p>
                </div>
            </div>
        </div>
        <p class="text-lg">Enterキーを押して戻る</p>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;

// Mock results
const results = ref([
    { text: 'はい', votes: 10, color: '#ff0000' },
    { text: 'いいえ', votes: 5, color: '#00ff00' },
    { text: 'わからない', votes: 3, color: '#0000ff' },
    { text: 'どちらでも', votes: 2, color: '#ffff00' },
]);

onMounted(() => {
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    document.removeEventListener('keydown', handleKeydown);
});

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        // Go back to octopus-scheduler
        router.push('/');
    }
};
</script>

<style scoped>
.result-item {
    min-height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>