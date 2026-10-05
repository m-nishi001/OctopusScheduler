<template>
    <div class="quiz-list">
        <div class="content">
            <div class="actions">
                <div class="action-buttons">
                    <button class="btn-add" @click="addQuiz">
                        新規クイズ追加
                    </button>
                </div>
                <div class="count">
                    総クイズ数: {{ quizzes.length }}
                </div>
            </div>
            <div v-if="copiedMessage" class="copied-message">{{ copiedMessage }}</div>
            <DataTable :columns="columns" :rows="quizzes">
                <template #cell-id="{ row }">
                    <span class="quiz-id" title="クリックしてIDをコピー" @click="copyToClipboard(row.id)">{{
                        row.id.substring(0, 8) }}</span>
                </template>
                <template #cell-title="{ row }">
                    <div class="quiz-title">{{ row.title }}</div>
                    <div class="quiz-question">{{ row.question }}</div>
                </template>
                <template #cell-optionCount="{ row }">{{ row.options.length }}</template>
                <template #cell-timeLimit="{ row }">{{ row.timeLimit }}秒</template>
                <template #cell-actions="{ index }">
                    <div class="action-buttons">
                        <button class="btn-edit" @click="editQuiz(index)">編集</button>
                        <button class="btn-delete" @click="deleteQuiz(index)">削除</button>
                        <button class="btn-preview" @click="previewQuiz(index)">プレビュー</button>
                    </div>
                </template>
            </DataTable>
        </div>

        <QuizModal v-if="showModal" :isEditing="isEditing" :currentQuiz="currentQuiz" @save="handleSave"
            @close="closeModal" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { DataTable, type DataTableColumn } from '@octopus/ui-kit';
import QuizModal from './quiz-modal.vue';
import { GetAllQuizzesUseCase } from '../../../../control/use-cases/get-all-quizzes-use-case';
import { AddQuizUseCase } from '../../../../control/use-cases/add-quiz-use-case';
import { UpdateQuizUseCase } from '../../../../control/use-cases/update-quiz-use-case';
import { DeleteQuizUseCase } from '../../../../control/use-cases/delete-quiz-use-case';
import type { QuizDto, AddQuizDto } from '../../../../control/dto/quiz-dto';

const router = useRouter();

const getAllQuizzesUseCase = container.resolve(GetAllQuizzesUseCase);
const addQuizUseCase = container.resolve(AddQuizUseCase);
const updateQuizUseCase = container.resolve(UpdateQuizUseCase);
const deleteQuizUseCase = container.resolve(DeleteQuizUseCase);

const columns: DataTableColumn[] = [
    { key: 'id', label: 'ID' },
    { key: 'title', label: 'クイズ名' },
    { key: 'optionCount', label: '選択肢数' },
    { key: 'timeLimit', label: '回答時間' },
    { key: 'actions', label: '操作' },
];

const quizzes = ref<QuizDto[]>([]);

const showModal = ref(false);
const isEditing = ref(false);
const editingIndex = ref(-1);
const currentQuiz = ref<QuizDto>({
    id: '',
    title: '',
    question: '',
    timeLimit: 30,
    options: [],
    bgm: null,
    settings: {
        correctBgm: null,
        prizeImage: null,
        prizeName: null,
        prizeBgm: null,
    },
});

const copiedMessage = ref('');

onMounted(async () => {
    try {
        const dtos = await getAllQuizzesUseCase.execute();
        quizzes.value = dtos;
    } catch (error) {
        console.error('クイズ一覧取得エラー:', error);
    }
});

const addQuiz = () => {
    currentQuiz.value = {
        id: crypto.randomUUID(),
        title: '',
        question: '',
        timeLimit: 30,
        options: [],
        bgm: null,
        settings: {
            correctBgm: null,
            prizeImage: null,
            prizeName: null,
            prizeBgm: null,
        },
    };
    isEditing.value = false;
    showModal.value = true;
};

const editQuiz = (index: number) => {
    currentQuiz.value = { ...quizzes.value[index] };
    editingIndex.value = index;
    isEditing.value = true;
    showModal.value = true;
};

const deleteQuiz = async (index: number) => {
    try {
        const quiz = quizzes.value[index];
        await deleteQuizUseCase.execute({ id: quiz.id });
        quizzes.value.splice(index, 1);
    } catch (error) {
        console.error('削除エラー:', error);
    }
};

const handleSave = async (quiz: QuizDto) => {
    try {
        if (isEditing.value) {
            // 更新
            await updateQuizUseCase.execute(quiz);
            quizzes.value[editingIndex.value] = { ...quiz };
        } else {
            // 追加
            const addDto: AddQuizDto = {
                title: quiz.title,
                question: quiz.question,
                timeLimit: quiz.timeLimit,
                options: quiz.options,
                bgm: quiz.bgm,
                settings: quiz.settings,
            };
            const id = await addQuizUseCase.execute(addDto);
            const newQuiz = { ...quiz, id };
            quizzes.value.push(newQuiz);
        }
        closeModal();
    } catch (error) {
        console.error('保存エラー:', error);
    }
};

const closeModal = () => {
    showModal.value = false;
};

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        copiedMessage.value = 'IDをコピーしました';
        setTimeout(() => copiedMessage.value = '', 2000);
    } catch (err) {
        console.error('コピー失敗:', err);
    }
};

const previewQuiz = (index: number) => {
    const quiz = quizzes.value[index];
    // Start the preview flow by navigating to the intro preview route (injects preview:true)
    router.push({ name: 'quiz-intro-preview', params: { id: quiz.id } });
};
</script>

<style scoped>
.content {
    background-color: #1f2937;
    border-radius: 0.5rem;
    padding: 1rem;
}

.actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
}

.count {
    color: #9ca3af;
}

.copied-message {
    color: #10b981;
    font-weight: 600;
    margin-bottom: 0.5rem;
    text-align: center;
}

.quiz-id {
    color: #60a5fa;
    font-family: monospace;
    cursor: pointer;
}

.quiz-id:hover {
    color: #93c5fd;
}

.quiz-title {
    font-weight: 600;
    color: white;
}

.quiz-question {
    color: #9ca3af;
    font-size: 0.875rem;
    overflow-wrap: anywhere;
}

.btn-add,
.btn-edit,
.btn-delete,
.btn-preview {
    color: white;
    font-weight: 600;
    padding: 0.35rem 0.75rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
}

.btn-add,
.btn-preview {
    background-color: #10b981;
}

.btn-add:hover,
.btn-preview:hover {
    background-color: #059669;
}

.btn-edit {
    background-color: #3b82f6;
}

.btn-edit:hover {
    background-color: #2563eb;
}

.btn-delete {
    background-color: #ef4444;
}

.btn-delete:hover {
    background-color: #dc2626;
}

.action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}
</style>
