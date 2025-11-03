<template>
    <div class="quiz-admin">
        <div class="container">
            <header class="header">
                <h1 class="title">
                    クイズ設定
                </h1>
            </header>

            <div class="content">
                <div class="actions">
                    <button class="btn-add" @click="addQuiz">
                        新規クイズ追加
                    </button>
                    <div class="count">
                        総クイズ数: {{ quizzes.length }}
                    </div>
                </div>

                <table class="quiz-table">
                    <thead class="table-head">
                        <tr>
                            <th class="th-id">ID</th>
                            <th class="th-title">クイズ名</th>
                            <th class="th-options">選択肢数</th>
                            <th class="th-time">回答時間</th>
                            <th class="th-actions">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(quiz, index) in quizzes" :key="index" class="table-row">
                            <td class="td-id">{{ quiz.id }}</td>
                            <td class="td-content">
                                <div class="quiz-title">{{ quiz.title }}</div>
                                <div class="quiz-question">{{ quiz.question }}</div>
                            </td>
                            <td class="td-options">{{ quiz.options.length }}</td>
                            <td class="td-time">{{ quiz.timeLimit }}秒</td>
                            <td class="td-actions">
                                <div class="action-buttons">
                                    <button class="btn-edit" @click="editQuiz(index)">
                                        編集
                                    </button>
                                    <button class="btn-delete" @click="deleteQuiz(index)">
                                        削除
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <QuizModal :showModal="showModal" :isEditing="isEditing" :currentQuiz="currentQuiz" @save="handleSave"
                @close="closeModal" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import QuizModal from './components/quiz-modal.vue';

interface QuizOption {
    no: number;
    text: string;
    image?: string;
    themeColor: string;
}

interface Quiz {
    id: number;
    title: string;
    question: string;
    answerUrl: string;
    timeLimit: number;
    options: QuizOption[];
}

const quizzes = ref<Quiz[]>([
    {
        id: 1,
        title: 'サンプルクイズ1',
        question: 'これはサンプルクイズです。',
        answerUrl: 'https://example.com/answer1',
        timeLimit: 30,
        options: [
            { no: 1, text: 'はい', image: '', themeColor: 'red' },
            { no: 2, text: 'いいえ', image: '', themeColor: 'blue' },
        ],
    },
]);

const showModal = ref(false);
const isEditing = ref(false);
const editingIndex = ref(-1);
const currentQuiz = ref<Quiz>({
    id: 0,
    title: '',
    question: '',
    answerUrl: '',
    timeLimit: 30,
    options: [],
});

const addQuiz = () => {
    currentQuiz.value = {
        id: quizzes.value.length + 1,
        title: '',
        question: '',
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

const handleSave = (quiz: Quiz) => {
    if (isEditing.value) {
        quizzes.value[editingIndex.value] = { ...quiz };
    } else {
        quizzes.value.push({ ...quiz });
    }
    closeModal();
};

const closeModal = () => {
    showModal.value = false;
};
</script>

<style scoped>
.quiz-admin {
    min-height: 100vh;
    background-color: #111827;
    /* bg-gray-900 */
    color: white;
    font-family: system-ui, sans-serif;
}

.container {
    padding: 1.5rem;
    /* p-6 */
}

.header {
    margin-bottom: 2rem;
    /* mb-8 */
}

.title {
    font-size: 1.5rem;
    /* text-2xl */
    font-weight: bold;
    text-align: center;
    margin-bottom: 0.5rem;
    /* mb-2 */
    color: white;
}

.content {
    background-color: #1f2937;
    /* bg-gray-800 */
    border-radius: 0.5rem;
    /* rounded-lg */
    padding: 1.5rem;
    /* p-6 */
    margin-bottom: 1.5rem;
    /* mb-6 */
}

.actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    /* mb-6 */
}

.btn-add {
    background-color: #10b981;
    /* bg-green-500 */
    color: white;
    font-weight: 600;
    /* font-semibold */
    padding: 0.5rem 1rem;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
}

.btn-add:hover {
    background-color: #059669;
    /* hover:bg-green-600 */
}

.count {
    color: #9ca3af;
    /* text-gray-400 */
}

.quiz-table {
    width: 90vw;
    margin: 0 auto;
    border-collapse: collapse;
    background-color: #374151;
    /* bg-gray-700 */
    border-radius: 0.5rem;
    /* rounded-lg */
    overflow: hidden;
    border: 1px solid #4b5563;
    /* border-gray-600 */
    table-layout: fixed;
}

.table-head {
    background-color: #4b5563;
    /* bg-gray-600 */
}

.th-id {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 10%;
}

.th-title {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 45%;
}

.th-options {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 15%;
}

.th-time {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 15%;
}

.th-actions {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: center;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 15%;
}

.table-row {
    border-bottom: 1px solid #4b5563;
    /* border-gray-600 */
}

.table-row:hover {
    background-color: #4b5563;
    /* hover:bg-gray-650 approx */
}

.td-id {
    color: #60a5fa;
    /* text-blue-400 */
    font-family: monospace;
    font-weight: 500;
    text-align: center;
    vertical-align: middle;
    font-size: 1.125rem;
    /* text-lg */
}

.td-content,
.td-options,
.td-time,
.td-actions {
    padding: 1rem;
    /* py-4 px-4 */
    border: 1px solid #6b7280;
    /* border-gray-500 */
}

.quiz-title {
    font-weight: 600;
    /* font-semibold */
    color: white;
    margin-bottom: 0.25rem;
}

.quiz-question {
    color: #9ca3af;
    /* text-gray-400 */
    font-size: 0.875rem;
    /* text-sm */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20rem;
    /* max-w-xs */
}

.td-options,
.td-time {
    color: #d1d5db;
    /* text-gray-300 */
}

.action-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    /* space-x-2 */
}

.btn-edit {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    padding: 0.5rem 0.75rem;
    min-width: 3.6rem;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 1rem;
    /* text-base */
    border: none;
    cursor: pointer;
}

.btn-edit:hover {
    background-color: #2563eb;
    /* hover:bg-blue-600 */
}

.btn-delete {
    background-color: #ef4444;
    /* bg-red-500 */
    color: white;
    padding: 0.5rem 0.75rem;
    min-width: 3.6rem;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 1rem;
    /* text-base */
    border: none;
    cursor: pointer;
}

.btn-delete:hover {
    background-color: #dc2626;
    /* hover:bg-red-600 */
}
</style>