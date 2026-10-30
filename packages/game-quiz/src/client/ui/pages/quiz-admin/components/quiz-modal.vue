<template>
    <UiDialog :model-value="true" :title="isEditing ? 'クイズ編集' : 'クイズ追加'" size="lg" :close-on-overlay="false"
        @close="closeModal">
        <form id="quiz-form" class="form" @submit.prevent="saveQuiz">
            <QuizBasicFields :current-quiz="currentQuiz" />
            <QuizMediaFields :current-quiz="currentQuiz" />
            <QuizOptionsTable :options="currentQuiz.options" @add="addOption" @edit="editOption"
                @remove="removeOption" />
        </form>
        <template #footer>
            <UiButton @click="closeModal">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="quiz-form">保存</UiButton>
        </template>
    </UiDialog>
    <QuizOptionModal v-if="showOptionModal" :isEditing="isEditingOption" :currentOption="currentOption"
        :options="currentQuiz.options" @save="saveOption" @close="closeOptionModal" />
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { ref, onMounted } from 'vue';
import QuizOptionModal from './quiz-option-modal.vue';
import QuizBasicFields from './quiz-basic-fields.vue';
import QuizMediaFields from './quiz-media-fields.vue';
import QuizOptionsTable from './quiz-options-table.vue';
import { addOption as addQuizOption, nextOptionNo, removeOption as removeQuizOption } from '../../../../model/quiz';
import type { QuizDto } from '../../../../control/dto/quiz-dto';

const props = defineProps<{
    isEditing: boolean;
    currentQuiz: QuizDto;
}>();

const emit = defineEmits<{
    save: [quiz: QuizDto];
    close: [];
}>();

const showOptionModal = ref(false);
const isEditingOption = ref(false);
const editingOptionIndex = ref(-1);
const currentOption = ref<{ no: number; text: string; image: Blob | null; color: string }>({ no: 0, text: '', image: null, color: 'red' });

const closeModal = () => {
    emit('close');
};

const saveQuiz = () => {
    emit('save', props.currentQuiz);
};

const addOption = () => {
    currentOption.value = { no: nextOptionNo(props.currentQuiz.options), text: '', image: null, color: 'red' };
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
        // 画像Blobが変わっていればimageSrc()呼び出し時にquiz-options-table.vue側の
        // objectUrlStoreが自動的に古いプレビューURLを失効させる(noが変わらない前提)。
        props.currentQuiz.options[editingOptionIndex.value] = { ...currentOption.value };
    } else {
        const { no: _no, ...fields } = currentOption.value;
        Object.assign(props.currentQuiz, addQuizOption(props.currentQuiz, fields));
    }
    closeOptionModal();
};

const removeOption = (no: number) => {
    Object.assign(props.currentQuiz, removeQuizOption(props.currentQuiz, no));
};

const closeOptionModal = () => {
    showOptionModal.value = false;
};

onMounted(() => {
    // Initialize settings if not present
    if (!props.currentQuiz.settings) {
        props.currentQuiz.settings = {
            correctBgm: null,
            prizeImage: null,
            prizeName: null,
            prizeBgm: null,
        };
    }
});
</script>

<style scoped>
.form {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-3, 12px);
}
</style>
