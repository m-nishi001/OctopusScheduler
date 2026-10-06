<template>
    <div class="form-group">
        <label>選択肢</label>
        <DataTable :columns="columns" :rows="rows" empty-text="選択肢がありません">
            <template #cell-image="{ row }">
                <img v-if="row.option.image" :src="imageSrc(row.option)" alt="プレビュー" class="preview-image" />
                <span v-else>画像なし</span>
            </template>
            <template #cell-color="{ row }">
                <span class="color-preview" :style="{ backgroundColor: row.option.color }"></span>
            </template>
            <template #cell-actions="{ row }">
                <div class="row-actions">
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="emit('edit', row.index)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除"
                        @click="removeOption(row.index)" />
                </div>
            </template>
        </DataTable>
        <div class="add-row">
            <UiButton icon="add" @click="emit('add')">選択肢を追加</UiButton>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { DataTable, UiButton } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import type { QuizDto } from '../../../../control/dto/quiz-dto';
import { useObjectUrlStore } from '../../../composables/use-object-url-store';

const props = defineProps<{
    options: QuizDto['options'];
}>();

const emit = defineEmits<{
    edit: [index: number];
    add: [];
}>();

const columns: DataTableColumn[] = [
    { key: 'no', label: 'No' },
    { key: 'text', label: '内容' },
    { key: 'image', label: '画像' },
    { key: 'color', label: 'テーマカラー' },
    { key: 'actions', label: '操作' },
];

const rows = computed(() => props.options.map((option, index) => ({ no: option.no, text: option.text, option, index })));

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
.preview-image {
    display: block;
    max-width: 80px;
    max-height: 60px;
    object-fit: contain;
}

.color-preview {
    display: inline-block;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    border: 1px solid var(--ui-border, #3a4048);
}

.row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}

.add-row {
    margin-top: var(--ui-space-2, 8px);
}
</style>
