<template>
    <div class="quiz-admin">
        <div class="container">
            <header class="header">
                <h1 class="title">
                    クイズ管理システム
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

            <!-- Modal for add/edit -->
            <div v-if="showModal" class="modal-overlay">
                <div class="modal">
                    <div class="modal-header">
                        <h2 class="modal-title">{{ isEditing ? 'クイズ編集' : 'クイズ追加' }}</h2>
                        <button class="btn-close" @click="closeModal">✕</button>
                    </div>
                    <form class="form" @submit.prevent="saveQuiz">
                        <div class="form-grid">
                            <div class="form-group">
                                <label class="form-label">クイズ名</label>
                                <input v-model="currentQuiz.title" type="text" class="form-input" required />
                            </div>
                            <div class="form-group">
                                <label class="form-label">回答時間 (秒)</label>
                                <input v-model.number="currentQuiz.timeLimit" type="number" class="form-input"
                                    required />
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label">クイズ内容</label>
                            <textarea v-model="currentQuiz.question" class="form-textarea" rows="3" required></textarea>
                        </div>
                        <div class="form-group">
                            <label class="form-label">回答URL</label>
                            <input v-model="currentQuiz.answerUrl" type="url" class="form-input" required />
                        </div>
                        <div class="form-group">
                            <label class="form-label">選択肢</label>
                            <div v-for="(option, index) in currentQuiz.options" :key="index" class="option-item">
                                <div class="option-input-group">
                                    <input v-model="option.text" type="text" placeholder="選択肢内容"
                                        class="form-input option-input" />
                                    <button class="btn-remove-option" @click="removeOption(index)">削除</button>
                                </div>
                            </div>
                            <button class="btn-add-option" @click="addOption">選択肢追加</button>
                        </div>
                        <div class="form-actions">
                            <button class="btn-cancel" @click="closeModal">キャンセル</button>
                            <button type="submit" class="btn-save">保存</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface QuizOption {
    text: string;
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
            { text: 'はい' },
            { text: 'いいえ' },
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
    currentQuiz.value.options.push({ text: '' });
};

const removeOption = (index: number) => {
    currentQuiz.value.options.splice(index, 1);
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
}

.table-head {
    background-color: #4b5563;
    /* bg-gray-600 */
}

.th-id,
.th-title,
.th-options,
.th-time,
.th-actions {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
}

.th-actions {
    text-align: center;
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
    gap: 0.5rem;
    /* space-x-2 */
}

.btn-edit {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    padding: 0.25rem 0.75rem;
    /* py-1 px-3 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 0.875rem;
    /* text-sm */
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
    padding: 0.25rem 0.75rem;
    /* py-1 px-3 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 0.875rem;
    /* text-sm */
    border: none;
    cursor: pointer;
}

.btn-delete:hover {
    background-color: #dc2626;
    /* hover:bg-red-600 */
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.5);
    /* bg-black bg-opacity-50 */
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
}

.modal {
    background-color: white;
    color: black;
    padding: 1.5rem;
    /* p-6 */
    border-radius: 0.5rem;
    /* rounded-lg */
    width: 90%;
    max-width: 42rem;
    /* max-w-2xl */
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    /* mb-6 */
}

.modal-title {
    font-size: 1.25rem;
    /* text-xl */
    font-weight: bold;
}

.btn-close {
    background-color: #6b7280;
    /* bg-gray-500 */
    color: white;
    padding: 0.25rem 0.75rem;
    /* py-1 px-3 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
}

.btn-close:hover {
    background-color: #4b5563;
    /* hover:bg-gray-600 */
}

.form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* space-y-4 */
}

.form-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
    /* gap-4 */
}

@media (min-width: 768px) {
    .form-grid {
        grid-template-columns: 1fr 1fr;
        /* md:grid-cols-2 */
    }
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-label {
    display: block;
    font-size: 0.875rem;
    /* text-sm */
    font-weight: bold;
    margin-bottom: 0.5rem;
    /* mb-2 */
    color: #374151;
    /* text-gray-700 */
}

.form-input,
.form-textarea {
    width: 100%;
    padding: 0.5rem;
    /* p-2 */
    border: 1px solid #d1d5db;
    /* border-gray-300 */
    border-radius: 0.25rem;
    /* rounded */
    font-family: inherit;
}

.form-input:focus,
.form-textarea:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6;
    /* focus:ring-2 focus:ring-blue-500 */
}

.form-textarea {
    resize: vertical;
}

.option-item {
    border: 1px solid #e5e7eb;
    /* border-gray-200 */
    border-radius: 0.25rem;
    /* rounded */
    padding: 0.75rem;
    /* p-3 */
    margin-bottom: 0.5rem;
    /* mb-2 */
    background-color: #f9fafb;
    /* bg-gray-50 */
}

.option-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* space-x-2 */
}

.option-input {
    flex: 1;
}

.btn-remove-option {
    background-color: #ef4444;
    /* bg-red-500 */
    color: white;
    padding: 0.25rem 0.5rem;
    /* py-1 px-2 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 0.875rem;
    /* text-sm */
    border: none;
    cursor: pointer;
}

.btn-remove-option:hover {
    background-color: #dc2626;
    /* hover:bg-red-600 */
}

.btn-add-option {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    padding: 0.25rem 0.75rem;
    /* py-1 px-3 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 0.875rem;
    /* text-sm */
    border: none;
    cursor: pointer;
}

.btn-add-option:hover {
    background-color: #2563eb;
    /* hover:bg-blue-600 */
}

.form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    /* space-x-4 */
}

.btn-cancel {
    background-color: #6b7280;
    /* bg-gray-500 */
    color: white;
    padding: 0.5rem 1rem;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
}

.btn-cancel:hover {
    background-color: #4b5563;
    /* hover:bg-gray-600 */
}

.btn-save {
    background-color: #10b981;
    /* bg-green-500 */
    color: white;
    padding: 0.5rem 1rem;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
}

.btn-save:hover {
    background-color: #059669;
    /* hover:bg-green-600 */
}
</style>