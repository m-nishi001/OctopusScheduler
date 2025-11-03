<template>
    <div v-if="showModal" class="option-modal-overlay">
        <div class="option-modal">
            <div class="modal-header">
                <h3 class="modal-title">{{ isEditing ? '選択肢編集' : '選択肢追加' }}</h3>
                <button class="btn-close" @click="closeModal">✕</button>
            </div>
            <form class="form" @submit.prevent="saveOption">
                <div class="form-group">
                    <label class="form-label">No</label>
                    <input v-model.number="currentOption.no" type="number" class="form-input" required />
                </div>
                <div class="form-group">
                    <label class="form-label">内容</label>
                    <input v-model="currentOption.text" type="text" class="form-input" required />
                </div>
                <div class="form-group">
                    <label class="form-label">画像</label>
                    <input v-model="currentOption.image" type="text" class="form-input" />
                </div>
                <div class="form-group">
                    <label class="form-label">テーマカラー</label>
                    <select v-model="currentOption.themeColor" class="form-input">
                        <option value="red">赤</option>
                        <option value="blue">青</option>
                        <option value="green">緑</option>
                        <option value="yellow">黄</option>
                        <option value="purple">紫</option>
                    </select>
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
    no: number;
    text: string;
    image?: string;
    themeColor: string;
}

const props = defineProps<{
    showModal: boolean;
    isEditing: boolean;
    currentOption: QuizOption;
}>();

const emit = defineEmits<{
    save: [option: QuizOption];
    close: [];
}>();

const closeModal = () => {
    emit('close');
};

const saveOption = () => {
    emit('save', props.currentOption);
};
</script>

<style scoped>
.option-modal-overlay {
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
    z-index: 60;
}

.option-modal {
    background-color: #1f2937;
    /* bg-gray-800 */
    color: white;
    padding: 1.5rem;
    /* p-6 */
    border-radius: 0.5rem;
    /* rounded-lg */
    width: 90%;
    max-width: 32rem;
    /* max-w-lg */
    border: 1px solid #4b5563;
    /* border-gray-600 */
}

.option-modal .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    /* mb-6 */
}

.option-modal .modal-title {
    font-size: 1.125rem;
    /* text-lg */
    font-weight: bold;
    color: white;
}

.option-modal .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* space-y-4 */
}

.option-modal .form-group {
    display: flex;
    flex-direction: column;
}

.option-modal .form-label {
    display: block;
    font-size: 0.875rem;
    /* text-sm */
    font-weight: bold;
    margin-bottom: 0.5rem;
    /* mb-2 */
    color: #d1d5db;
    /* text-gray-300 */
}

.option-modal .form-input {
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

.option-modal .form-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6;
    /* focus:ring-2 focus:ring-blue-500 */
}

.option-modal .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: 1rem;
    /* space-x-4 */
}

.option-modal .btn-cancel {
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

.option-modal .btn-cancel:hover {
    background-color: #4b5563;
    /* hover:bg-gray-600 */
}

.option-modal .btn-save {
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

.option-modal .btn-save:hover {
    background-color: #059669;
    /* hover:bg-green-600 */
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
</style>