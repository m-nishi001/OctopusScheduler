<template>
    <div class="quiz-display flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 class="text-4xl mb-8">{{ quiz.title }}</h1>
        <div class="mb-8">
            <p class="text-xl mb-4">{{ quiz.question }}</p>
            <div class="grid grid-cols-2 gap-4">
                <div v-for="(option, index) in quiz.options" :key="index" class="option p-4 rounded-lg cursor-pointer"
                    :style="{ backgroundColor: option.color }" @click="selectOption(index)">
                    <img v-if="option.image" :src="option.image" alt="" class="w-16 h-16 mb-2" />
                    <p>{{ option.text }}</p>
                </div>
            </div>
        </div>
        <div class="mb-8">
            <p class="text-lg">回答URL:</p>
            <img :src="qrCodeUrl" alt="QR Code" class="w-32 h-32" />
        </div>
        <div class="text-2xl">残り時間: {{ timeLeft }}秒</div>
        <!-- Modal for time up -->
        <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div class="bg-white text-black p-8 rounded-lg">
                <h2 class="text-2xl mb-4">終了！</h2>
                <p>回答時間が終了しました。</p>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';

const route = useRoute();
const router = useRouter();

const quizId = route.params.id as string;

// Mock quiz data
const quiz = ref({
    title: 'クイズ ' + quizId,
    question: 'これはサンプルの質問です？',
    options: [
        { text: 'はい', color: '#ff0000', image: '' },
        { text: 'いいえ', color: '#00ff00', image: '' },
        { text: 'わからない', color: '#0000ff', image: '' },
        { text: 'どちらでも', color: '#ffff00', image: '' },
    ],
    answerUrl: 'https://example.com/answer',
    timeLimit: 30, // seconds
});

const timeLeft = ref(quiz.value.timeLimit);
const showModal = ref(false);
// setInterval can return different types depending on DOM vs Node typings.
// Use ReturnType<typeof setInterval> to be compatible across environments.
let timer: ReturnType<typeof setInterval> | undefined;

const qrCodeUrl = ref(`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(quiz.value.answerUrl)}`);

onMounted(() => {
    startTimer();
    document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
    if (timer) clearInterval(timer);
    document.removeEventListener('keydown', handleKeydown);
});

const startTimer = () => {
    timer = setInterval(() => {
        timeLeft.value--;
        if (timeLeft.value <= 0) {
            if (timer) clearInterval(timer);
            showModal.value = true;
        }
    }, 1000);
};

const selectOption = (index: number) => {
    console.log('Selected option:', index);
};

const handleKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
        router.push(`/quiz-result/${quizId}`);
    }
};
</script>

<style scoped>
.option {
    min-height: 100px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}
</style>