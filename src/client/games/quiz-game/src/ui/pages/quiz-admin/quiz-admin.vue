<template>
    <div class="quiz-admin min-h-screen bg-gray-900 text-white p-4">
        <h1 class="text-4xl mb-8">クイズ管理</h1>
        <button @click="addQuiz" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mb-4">
            新しいクイズを追加
        </button>
        <div class="quiz-list">
            <div v-for="(quiz, index) in quizzes" :key="index" class="quiz-item bg-gray-800 p-4 mb-4 rounded">
                <h2 class="text-xl">{{ quiz.title }}</h2>
                <p>シーケンス: {{ quiz.id }}</p>
                <button @click="editQuiz(index)"
                    class="bg-green-500 hover:bg-green-700 text-white font-bold py-1 px-2 rounded mr-2">
                    編集
                </button>
                <button @click="deleteQuiz(index)"
                    class="bg-red-500 hover:bg-red-700 text-white font-bold py-1 px-2 rounded">
                    削除
                </button>
            </div>
        </div>
        <!-- Modal for add/edit -->
        <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <div class="bg-white text-black p-8 rounded-lg w-1/2">
                <h2 class="text-2xl mb-4">{{ isEditing ? 'クイズ編集' : 'クイズ追加' }}</h2>
                <form @submit.prevent="saveQuiz">
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-2">クイズ名</label>
                        <input v-model="currentQuiz.title" type="text" class="w-full p-2 border rounded" required />
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-2">回答URL</label>
                        <input v-model="currentQuiz.answerUrl" type="url" class="w-full p-2 border rounded" required />
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-2">回答時間 (秒)</label>
                        <input v-model.number="currentQuiz.timeLimit" type="number" class="w-full p-2 border rounded"
                            required />
                    </div>
                    <div class="mb-4">
                        <label class="block text-sm font-bold mb-2">選択肢</label>
                        <div v-for="(option, index) in currentQuiz.options" :key="index" class="mb-2">
                            <input v-model="option.text" type="text" placeholder="選択肢内容"
                                class="w-1/2 p-2 border rounded mr-2" />
                            <input v-model="option.color" type="color" class="mr-2" />
                            <button @click="removeOption(index)"
                                class="bg-red-500 text-white px-2 py-1 rounded">削除</button>
                        </div>
                        <button @click="addOption" class="bg-blue-500 text-white px-2 py-1 rounded">選択肢追加</button>
                    </div>
                    <div class="flex justify-end">
                        <button @click="closeModal" class="bg-gray-500 text-white px-4 py-2 rounded mr-2">キャンセル</button>
                        <button type="submit" class="bg-green-500 text-white px-4 py-2 rounded">保存</button>
                    </div>
                </form>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface QuizOption {
    text: string;
    color: string;
    image?: string;
}

interface Quiz {
    id: number;
    title: string;
    answerUrl: string;
    timeLimit: number;
    options: QuizOption[];
}

const quizzes = ref<Quiz[]>([
    {
        id: 1,
        title: 'サンプルクイズ1',
        answerUrl: 'https://example.com/answer1',
        timeLimit: 30,
        options: [
            { text: 'はい', color: '#ff0000' },
            { text: 'いいえ', color: '#00ff00' },
        ],
    },
]);

const showModal = ref(false);
const isEditing = ref(false);
const editingIndex = ref(-1);
const currentQuiz = ref<Quiz>({
    id: 0,
    title: '',
    answerUrl: '',
    timeLimit: 30,
    options: [],
});

const addQuiz = () => {
    currentQuiz.value = {
        id: quizzes.value.length + 1,
        title: '',
        answerUrl: '',
        timeLimit: 30,
        options: [],
    };
    isEditing.value = false;
    showModal.value = true;
};

const editQuiz = (index: number) => {
    currentQuiz.value = { ...quizzes.value[index] };
    editingIndex.value = index;
    isEditing.value = true;
    showModal.value = true;
};

const deleteQuiz = (index: number) => {
    quizzes.value.splice(index, 1);
};

const saveQuiz = () => {
    if (isEditing.value) {
        quizzes.value[editingIndex.value] = { ...currentQuiz.value };
    } else {
        quizzes.value.push({ ...currentQuiz.value });
    }
    closeModal();
};

const closeModal = () => {
    showModal.value = false;
};

const addOption = () => {
    currentQuiz.value.options.push({ text: '', color: '#ffffff' });
};

const removeOption = (index: number) => {
    currentQuiz.value.options.splice(index, 1);
};
</script>