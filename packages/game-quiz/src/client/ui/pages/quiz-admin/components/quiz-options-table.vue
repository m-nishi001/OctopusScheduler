<template>
    <div class="form-group">
        <label class="form-label">選択肢</label>
        <div class="options-table-scroll">
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
                    <tr v-for="(option, index) in options" :key="index" class="table-row">
                        <td class="td-no">{{ option.no }}</td>
                        <td class="td-content">{{ option.text }}</td>
                        <td class="td-image">
                            <img v-if="option.image" :src="imageSrc(option)" alt="プレビュー"
                                class="preview-image" />
                            <span v-else>画像なし</span>
                        </td>
                        <td class="td-color">
                            <div class="color-preview" :style="{ backgroundColor: option.color }"></div>
                        </td>
                        <td class="td-actions">
                            <button type="button" class="btn-edit" @click="emit('edit', index)">編集</button>
                            <button type="button" class="btn-delete" @click="removeOption(index)">削除</button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
        <button type="button" class="btn-add-option" @click="emit('add')">+</button>
    </div>
</template>

<script setup lang="ts">
import type { QuizDto } from '../../../../control/dto/quiz-dto';
import { useObjectUrlStore } from '../../../composables/use-object-url-store';

const props = defineProps<{
    options: QuizDto['options'];
}>();

const emit = defineEmits<{
    edit: [index: number];
    add: [];
}>();

// 選択肢ごとの画像プレビュー用のobject URLを、noをキーに使い回して管理する。
const objectUrlStore = useObjectUrlStore();

const imageSrc = (option: { no: number; text?: string; image: Blob | null }) => {
    return objectUrlStore.ensure(`option-${option.no}`, option.image) ?? '';
};

const removeOption = (index: number) => {
    const option = props.options[index];
    objectUrlStore.revoke(`option-${option.no}`);
    props.options.splice(index, 1);
};
</script>

<style scoped>
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

.options-table-scroll {
    overflow-x: auto;
    margin-bottom: 1rem;
    border-radius: 0.5rem;
}

.options-table {
    width: 100%;
    min-width: 480px;
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

.preview-image {
    max-width: 80px;
    max-height: 80px;
    object-fit: cover;
    border-radius: 4px;
}

.color-preview {
    width: 40px;
    height: 20px;
    border-radius: 4px;
    border: 1px solid #6b7280;
}
</style>
