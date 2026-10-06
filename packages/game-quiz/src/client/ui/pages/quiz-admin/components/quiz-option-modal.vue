<template>
    <UiDialog :model-value="true" :title="isEditing ? '選択肢編集' : '選択肢追加'" size="sm" nested
        :close-on-overlay="false" @close="closeModal">
        <form id="quiz-option-form" @submit.prevent="saveOption">
            <p class="option-no">No: {{ currentOption.no }}</p>
            <div class="form-group">
                <label>内容</label>
                <input v-model="currentOption.text" type="text" required />
            </div>
            <div class="form-group">
                <label>画像</label>
                <input type="file" @change="handleImageUpload" accept="image/*" />
                <img v-if="currentOption.image" :src="imageSrc()" alt="プレビュー" class="image-preview" />
            </div>
            <div class="form-group">
                <label>テーマカラー</label>
                <div class="color-palette">
                    <button v-for="color in colors" :key="color.value" type="button" class="color-option"
                        :class="{ selected: currentOption.color === color.value }"
                        @click="currentOption.color = color.value">
                        <span class="color-swatch" :style="{ backgroundColor: color.hex }"></span>
                        <span>{{ color.label }}</span>
                    </button>
                </div>
            </div>
        </form>
        <template #footer>
            <UiButton @click="closeModal">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="quiz-option-form">保存</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { onUnmounted } from 'vue';

const props = defineProps<{
    isEditing: boolean;
    currentOption: { no: number; text: string; image: Blob | null; color: string };
    options: { no: number; text: string; image: Blob | null; color: string }[];
}>();

const colors = [
    { value: 'red', hex: '#ef4444', label: '赤' },
    { value: 'blue', hex: '#3b82f6', label: '青' },
    { value: 'green', hex: '#10b981', label: '緑' },
    { value: 'yellow', hex: '#f59e0b', label: '黄' },
    { value: 'purple', hex: '#8b5cf6', label: '紫' },
];

const emit = defineEmits<{
    save: [option: { no: number; text: string; image: Blob | null; color: string }];
    close: [];
}>();

let currentObjectUrl: string | undefined;

const imageSrc = () => {
    if (props.currentOption.image instanceof Blob) {
        if (currentObjectUrl) return currentObjectUrl;
        currentObjectUrl = URL.createObjectURL(props.currentOption.image);
        return currentObjectUrl;
    }
    return undefined;
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
        // 追加時は既存の最大 no の +1 を割り振る
        const maxNo = props.options.reduce((m, o) => Math.max(m, o.no || 0), 0);
        props.currentOption.no = maxNo + 1;
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
.option-no {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-text-muted, #cfd6dd);
}

.image-preview {
    display: block;
    margin-top: var(--ui-space-2, 8px);
    max-width: 200px;
    max-height: 200px;
    object-fit: contain;
    border-radius: var(--ui-radius, 6px);
    border: 1px solid var(--ui-border, #3a4048);
}

.color-palette {
    display: flex;
    flex-wrap: wrap;
    gap: var(--ui-space-2, 8px);
}

.color-option {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    padding: var(--ui-space-1, 4px) var(--ui-space-3, 12px);
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: var(--ui-radius, 6px);
    background: transparent;
    color: var(--ui-text, #fff);
    font: inherit;
    font-size: var(--ui-font-sm, 0.875rem);
    cursor: pointer;
}

.color-option.selected {
    border-color: var(--ui-accent, #aee1ff);
    box-shadow: 0 0 0 1px var(--ui-accent, #aee1ff);
}

.color-swatch {
    width: 16px;
    height: 16px;
    border-radius: 50%;
}
</style>
