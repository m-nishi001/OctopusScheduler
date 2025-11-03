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
                    <table class="options-table">
                        <thead class="table-head">
                            <tr>
                                <th class="th-no">No</th>
                                <th class="th-content">内容</th>
                                <th class="th-image">画像</th>
                                <th class="th-color">テーマカラー</th>
                                <th class="th-actions">操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="(option, index) in currentQuiz.options" :key="index" class="table-row">
                                <td class="td-no">{{ option.no }}</td>
                                <td class="td-content">{{ option.text }}</td>
                                <td class="td-image">{{ option.image }}</td>
                                <td class="td-color">{{ option.themeColor }}</td>
                                <td class="td-actions">
                                    <button class="btn-edit" @click="editOption(index)">編集</button>
                                    <button class="btn-delete" @click="removeOption(index)">削除</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <button class="btn-add-option" @click="addOption">+</button>
                </div>
                <div class="form-actions">
                    <button class="btn-cancel" @click="closeModal">キャンセル</button>
                    <button type="submit" class="btn-save">保存</button>
                </div>
            </form>
        </div>
    </div>
    <QuizOptionModal :showModal="showOptionModal" :isEditing="isEditingOption" :currentOption="currentOption"
        :options="currentQuiz.options" @save="saveOption" @close="closeOptionModal" />
</template>

<script setup lang="ts">
import { defineProps, defineEmits, ref } from 'vue';
import QuizOptionModal from './quiz-option-modal.vue';

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

const props = defineProps<{
    showModal: boolean;
    isEditing: boolean;
    currentQuiz: Quiz;
}>();

const emit = defineEmits<{
    save: [quiz: Quiz];
    close: [];
}>();

const showOptionModal = ref(false);
const isEditingOption = ref(false);
const editingOptionIndex = ref(-1);
const currentOption = ref<QuizOption>({ no: 0, text: '', image: '', themeColor: 'red' });

const closeModal = () => {
    emit('close');
};

const saveQuiz = () => {
    emit('save', props.currentQuiz);
};

const addOption = () => {
    const nextNo = props.currentQuiz.options.length + 1;
    currentOption.value = { no: nextNo, text: '', image: '', themeColor: 'red' };
    isEditingOption.value = false;
    showOptionModal.value = true;
};

const editOption = (index: number) => {
    currentOption.value = { ...props.currentQuiz.options[index] };
    editingOptionIndex.value = index;
    isEditingOption.value = true;
    showOptionModal.value = true;
};

const saveOption = () => {
    if (isEditingOption.value) {
        props.currentQuiz.options[editingOptionIndex.value] = { ...currentOption.value };
    } else {
        props.currentQuiz.options.push({ ...currentOption.value });
    }
    closeOptionModal();
};

const closeOptionModal = () => {
    showOptionModal.value = false;
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
    background-color: #1f2937;
    /* bg-gray-800 */
    color: white;
    padding: 1.5rem;
    /* p-6 */
    border-radius: 0.5rem;
    /* rounded-lg */
    width: 90%;
    max-width: 42rem;
    /* max-w-2xl */
    border: 1px solid #4b5563;
    /* border-gray-600 */
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
    color: white;
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
    gap: 2.75rem;
    /* gap-11 approx */
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
    color: #d1d5db;
    /* text-gray-300 */
}

.form-input,
.form-textarea {
    width: 100%;
    padding: 0.5rem;
    /* p-2 */
    border: 1px solid #4b5563;
    /* border-gray-600 */
    border-radius: 0.25rem;
    /* rounded */
    font-family: inherit;
    background-color: #374151;
    /* bg-gray-700 */
    color: white;
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
    border: 1px solid #4b5563;
    /* border-gray-600 */
    border-radius: 0.25rem;
    /* rounded */
    padding: 0.75rem;
    /* p-3 */
    margin-bottom: 0.5rem;
    /* mb-2 */
    background-color: #374151;
    /* bg-gray-700 */
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

.options-table {
    width: 100%;
    border-collapse: collapse;
    background-color: #374151;
    /* bg-gray-700 */
    border-radius: 0.5rem;
    /* rounded-lg */
    overflow: hidden;
    border: 1px solid #4b5563;
    /* border-gray-600 */
    margin-bottom: 1rem;
}

.table-head {
    background-color: #4b5563;
    /* bg-gray-600 */
}

.th-no,
.th-content,
.th-image,
.th-color,
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

.th-no {
    width: 10%;
}

.th-content {
    width: 30%;
}

.th-image {
    width: 20%;
}

.th-color {
    width: 20%;
}

.th-actions {
    width: 20%;
}

.table-row {
    border-bottom: 1px solid #4b5563;
    /* border-gray-600 */
}

.table-row:hover {
    background-color: #4b5563;
    /* hover:bg-gray-650 approx */
}

.td-no,
.td-content,
.td-image,
.td-color,
.td-actions {
    padding: 1rem;
    /* py-4 px-4 */
    border: 1px solid #6b7280;
    /* border-gray-500 */
}

.td-no {
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
.td-image,
.td-color {
    color: #d1d5db;
    /* text-gray-300 */
}

.btn-edit {
    background-color: #3b82f6;
    /* bg-blue-500 */
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

.btn-edit:hover {
    background-color: #2563eb;
    /* hover:bg-blue-600 */
}

.btn-delete {
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

.btn-delete:hover {
    background-color: #dc2626;
    /* hover:bg-red-600 */
}

.btn-add-option {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    padding: 0.5rem;
    border-radius: 50%;
    font-size: 1.5rem;
    /* text-2xl */
    border: none;
    cursor: pointer;
    width: 3rem;
    height: 3rem;
    display: flex;
    align-items: center;
    justify-content: center;
}

.btn-add-option:hover {
    background-color: #2563eb;
    /* hover:bg-blue-600 */
}
</style>