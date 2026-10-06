<template>
    <UiDialog :model-value="true" :title="isEditing ? 'クイズ編集' : 'クイズ追加'" size="lg" :close-on-overlay="false"
        @close="closeModal">
        <form id="quiz-form" class="form" @submit.prevent="saveQuiz">
            <QuizBasicFields :current-quiz="currentQuiz" />
            <QuizMediaFields :current-quiz="currentQuiz" />
            <QuizOptionsTable :options="currentQuiz.options" @add="addOption" @edit="editOption" />
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
import { ref, onMounted, watch } from 'vue';
import QuizOptionModal from './quiz-option-modal.vue';
import QuizBasicFields from './quiz-basic-fields.vue';
import QuizMediaFields from './quiz-media-fields.vue';
import QuizOptionsTable from './quiz-options-table.vue';
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
    const maxNo = props.currentQuiz.options.reduce((m, o) => Math.max(m, o.no || 0), 0);
    const nextNo = maxNo + 1;
    currentOption.value = { no: nextNo, text: '', image: null, color: 'red' };
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
        props.currentQuiz.options.push({ ...currentOption.value });
    }
    closeOptionModal();
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

    // ensure correctNo exists on the quiz object for UI usage
    if ((props.currentQuiz as any).correctNo == null) {
        (props.currentQuiz as any).correctNo = 1;
    }
});

// Watch option count and fallback correctNo to 1 when out of range
// Watch option numbers (join of nos) to detect add/remove/reorder and fallback correctNo
watch(() => props.currentQuiz.options.map(o => o.no).join(','), (_v, _o) => {
    const cq: any = props.currentQuiz;
    if (!cq) return;
    const len = props.currentQuiz.options.length;
    if (typeof cq.correctNo !== 'number' || cq.correctNo < 1 || cq.correctNo > Math.max(1, len)) {
        cq.correctNo = 1;
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
