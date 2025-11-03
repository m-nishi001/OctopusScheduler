<template>
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
                        <input v-model.number="currentQuiz.timeLimit" type="number" class="form-input" required />
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
                            <input v-model="option.text" type="text" placeholder="選択肢内容" class="form-input option-input" />
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
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

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

const props = defineProps<{
    showModal: boolean;
    isEditing: boolean;
    currentQuiz: Quiz;
}>();

const emit = defineEmits<{
    save: [quiz: Quiz];
    close: [];
}>();

const closeModal = () => {
    emit('close');
};

const saveQuiz = () => {
    emit('save', props.currentQuiz);
};

const addOption = () => {
    props.currentQuiz.options.push({ text: '' });
};

const removeOption = (index: number) => {
    props.currentQuiz.options.splice(index, 1);
};
</script>

<style scoped>
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