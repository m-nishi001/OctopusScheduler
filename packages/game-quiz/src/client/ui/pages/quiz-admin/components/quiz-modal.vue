<template>
    <div class="modal-overlay">
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">{{ isEditing ? 'クイズ編集' : 'クイズ追加' }}</h2>
            </div>
            <form class="form" @submit.prevent="saveQuiz">
                <QuizBasicFields :current-quiz="currentQuiz" />
                <QuizMediaFields :current-quiz="currentQuiz" />
                <QuizOptionsTable :options="currentQuiz.options" @add="addOption" @edit="editOption" />
                <div class="form-actions">
                    <button type="button" class="btn-cancel" @click="closeModal">キャンセル</button>
                    <button type="submit" class="btn-save">保存</button>
                </div>
            </form>
        </div>
    </div>
    <QuizOptionModal v-if="showOptionModal" :isEditing="isEditingOption" :currentOption="currentOption"
        :options="currentQuiz.options" @save="saveOption" @close="closeOptionModal" />
</template>

<script setup lang="ts">
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
    z-index: 51;
    max-height: 80vh;
    overflow-y: auto;
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

.form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    /* space-y-4 */
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

@media (max-width: 480px) {
    .modal {
        width: 100%;
        max-height: 90vh;
        padding: 1rem;
        border-radius: 0.5rem;
    }

    .form-actions {
        flex-direction: column-reverse;
    }

    .form-actions button {
        width: 100%;
    }
}
</style>
