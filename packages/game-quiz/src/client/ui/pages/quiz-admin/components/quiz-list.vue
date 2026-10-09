<template>
    <div class="quiz-list">
        <UiToolbar>
            <UiButton variant="primary" icon="add" @click="addQuiz">新規クイズ追加</UiButton>
            <span class="ui-toolbar__spacer count">総クイズ数: {{ quizzes.length }}</span>
        </UiToolbar>
        <DataTable :columns="columns" :rows="quizzes" row-key="id" :loading="loading" empty-text="クイズがありません">
            <template #cell-id="{ row }">
                <button type="button" class="quiz-id" title="クリックしてIDをコピー" @click="copyToClipboard(row.id)">{{
                    row.id.substring(0, 8) }}</button>
            </template>
            <template #cell-title="{ row }">
                <div class="quiz-title">{{ row.title }}</div>
                <div class="quiz-question">{{ row.question }}</div>
            </template>
            <template #cell-optionCount="{ row }">{{ row.options.length }}</template>
            <template #cell-timeLimit="{ row }">{{ row.timeLimit }}秒</template>
            <template #cell-actions="{ row }">
                <div class="row-actions">
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" @click="editQuiz(indexOf(row))" />
                    <UiButton size="sm" icon="play" icon-only aria-label="プレビュー" @click="previewQuiz(indexOf(row))" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除"
                        @click="deleteQuiz(indexOf(row))" />
                </div>
            </template>
        </DataTable>

        <QuizModal v-if="showModal" :isEditing="isEditing" :currentQuiz="currentQuiz" @save="handleSave"
            @close="closeModal" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { DataTable, UiButton, UiToolbar, toast, useConfirm, type DataTableColumn } from '@octopus/ui-kit';
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
const loading = ref(true);
const { confirmDelete } = useConfirm();
const indexOf = (row: QuizDto) => quizzes.value.findIndex((q) => q.id === row.id);

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

const loadQuizzes = async () => {
    try {
        quizzes.value = await getAllQuizzesUseCase.execute();
    } catch (error) {
        console.error('クイズ一覧取得エラー:', error);
        toast.error('クイズ一覧の取得に失敗しました');
    } finally {
        loading.value = false;
    }
};

// 別端末/新しいブラウザでは初回表示後に背景同期でクイズが取り込まれるため、
// 取り込み完了時に一覧を読み直す。編集中は editingIndex がずれないよう読み直さない。
const onSyncPulled = () => {
    if (!showModal.value) void loadQuizzes();
};

onMounted(() => {
    void loadQuizzes();
    eventBus.on('syncPulled', onSyncPulled);
});

onUnmounted(() => {
    eventBus.off('syncPulled', onSyncPulled);
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
    const quiz = quizzes.value[index];
    if (!(await confirmDelete(`「${quiz.title || quiz.id.substring(0, 8)}」を削除しますか?`))) return;
    try {
        await deleteQuizUseCase.execute({ id: quiz.id });
        quizzes.value.splice(index, 1);
    } catch (error) {
        console.error('削除エラー:', error);
        toast.error('削除に失敗しました');
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
        toast.error('保存に失敗しました');
    }
};

const closeModal = () => {
    showModal.value = false;
};

const copyToClipboard = async (text: string) => {
    try {
        await navigator.clipboard.writeText(text);
        toast.success('IDをコピーしました');
    } catch (err) {
        console.error('コピー失敗:', err);
        toast.error('コピーに失敗しました');
    }
};

const previewQuiz = (index: number) => {
    const quiz = quizzes.value[index];
    // Start the preview flow by navigating to the intro preview route (injects preview:true)
    router.push({ name: 'quiz-intro-preview', params: { id: quiz.id } });
};
</script>

<style scoped>
.count {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.quiz-id {
    appearance: none;
    background: none;
    border: none;
    padding: 0;
    color: var(--ui-accent, #aee1ff);
    font-family: monospace;
    font-size: var(--ui-font-sm, 0.875rem);
    cursor: pointer;
}

.quiz-title {
    font-weight: 700;
}

.quiz-question {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}
</style>
