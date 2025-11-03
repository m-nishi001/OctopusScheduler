<template>
    <div v-if="showModal" class="option-modal-overlay">
        <div class="option-modal">
            <div class="modal-header">
                <h3 class="modal-title">{{ isEditing ? '選択肢編集' : '選択肢追加' }}</h3>
            </div>
            <form class="form" @submit.prevent="saveOption">
                <div class="form-group">
                    <label class="form-label" style="font-size: 1rem;">No: {{ currentOption.no }}</label>
                </div>
                <div class="form-group">
                    <label class="form-label">内容</label>
                    <input v-model="currentOption.text" type="text" class="form-input" required />
                </div>
                <div class="form-group">
                    <label class="form-label">画像</label>
                    <input type="file" @change="handleImageUpload" accept="image/*" class="form-input" />
                    <img v-if="currentOption.image" :src="imageSrc()" alt="プレビュー" class="image-preview" />
                </div>
                <div class="form-group">
                    <label class="form-label">テーマカラー</label>
                    <div class="color-palette">
                        <div v-for="color in colors" :key="color.value" class="color-option"
                            :class="{ selected: currentOption.color === color.value }"
                            @click="currentOption.color = color.value">
                            <div class="color-swatch" :style="{ backgroundColor: color.hex }"></div>
                            <span>{{ color.label }}</span>
                        </div>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn-cancel" @click="closeModal">キャンセル</button>
                    <button type="submit" class="btn-save">保存</button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { onUnmounted } from 'vue';

const props = defineProps<{
    showModal: boolean;
    isEditing: boolean;
    currentOption: { no: number; text: string; image: Blob | string | null; color: string };
    options: { no: number; text: string; image: Blob | string | null; color: string }[];
}>();

const colors = [
    { value: 'red', hex: '#ef4444', label: '赤' },
    { value: 'blue', hex: '#3b82f6', label: '青' },
    { value: 'green', hex: '#10b981', label: '緑' },
    { value: 'yellow', hex: '#f59e0b', label: '黄' },
    { value: 'purple', hex: '#8b5cf6', label: '紫' },
];

const emit = defineEmits<{
    save: [option: { no: number; text: string; image: Blob | string | null; color: string }];
    close: [];
}>();

let currentObjectUrl: string | null = null;

const imageSrc = () => {
    if (props.currentOption.image instanceof Blob) {
        return URL.createObjectURL(props.currentOption.image);
    }
    return props.currentOption.image;
};

const closeModal = () => {
    emit('close');
};

const handleImageUpload = (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
        if (currentObjectUrl) {
            URL.revokeObjectURL(currentObjectUrl);
        }
        currentObjectUrl = URL.createObjectURL(file);
        props.currentOption.image = file; // Blobを直接セット
    }
};

const saveOption = () => {
    if (!props.isEditing) {
        // 追加時は自動的にnoを割り振る
        props.currentOption.no = props.options.length + 1;
    }
    emit('save', props.currentOption);
};

onUnmounted(() => {
    if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
    }
});
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



.image-preview {
    max-width: 100%;
    max-height: 200px;
    margin-top: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #4b5563;
    object-fit: contain;
}

.color-palette {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
}

.color-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 2px solid transparent;
    transition: border-color 0.2s;
}

.color-option:hover {
    border-color: #6b7280;
}

.color-option.selected {
    border-color: #3b82f6;
}

.color-swatch {
    width: 2rem;
    height: 2rem;
    border-radius: 0.25rem;
    margin-bottom: 0.25rem;
}

.color-option span {
    font-size: 0.75rem;
    color: #d1d5db;
}
</style>