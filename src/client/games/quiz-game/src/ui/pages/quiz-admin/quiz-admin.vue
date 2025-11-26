<template>
    <div class="quiz-admin">
        <div class="container">
            <header class="header">
                <h1 class="title">
                    クイズ設定
                </h1>
            </header>

            <div class="content">
                <div class="actions">
                    <div class="action-buttons">
                        <button class="btn-add" @click="addQuiz">
                            新規クイズ追加
                        </button>
                        <button class="btn-sync" @click="showSyncDialog = true">
                            一括同期
                        </button>
                    </div>
                    <div class="count">
                        総クイズ数: {{ quizzes.length }}
                    </div>
                </div>
                <div v-if="copiedMessage" class="copied-message">{{ copiedMessage }}</div>
                <table class="quiz-table">
                    <thead class="table-head">
                        <tr>
                            <th class="th-id">ID</th>
                            <th class="th-title">クイズ名</th>
                            <th class="th-options">選択肢数</th>
                            <th class="th-time">回答時間</th>
                            <th class="th-actions">操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="(quiz, index) in quizzes" :key="index" class="table-row">
                            <td class="td-id" @click="copyToClipboard(quiz.id)" title="クリックしてIDをコピー">{{
                                quiz.id.substring(0, 8) }}</td>
                            <td class="td-content">
                                <div class="quiz-title">{{ quiz.title }}</div>
                                <div class="quiz-question">{{ quiz.question }}</div>
                            </td>
                            <td class="td-options">{{ quiz.options.length }}</td>
                            <td class="td-time">{{ quiz.timeLimit }}秒</td>
                            <td class="td-actions">
                                <div class="action-buttons">
                                    <button class="btn-edit" @click="editQuiz(index)">
                                        編集
                                    </button>
                                    <button class="btn-delete" @click="deleteQuiz(index)">
                                        削除
                                    </button>
                                    <button class="btn-preview" @click="previewQuiz(index)">
                                        プレビュー
                                    </button>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <QuizModal :showModal="showModal" :isEditing="isEditing" :currentQuiz="currentQuiz" @save="handleSave"
                @close="closeModal" />

            <dialog :open="showSyncDialog" class="sync-dialog">
                <h2>同期方向を選択（全体）</h2>
                <div class="dialog-buttons">
                    <button @click="selectDirection('gas-to-local')">GAS → ローカル（上書き）</button>
                    <button @click="selectDirection('local-to-gas')">ローカル → GAS（Driveを完全に上書き）</button>
                    <button @click="showSyncDialog = false">キャンセル</button>
                </div>
            </dialog>

            <dialog :open="showConfirmDialog" class="sync-dialog">
                <h2>完全上書きの確認</h2>
                <p>「ローカル → GAS」を選択すると、ターゲットのDriveフォルダ内の既存ファイルは削除され、ローカルの内容で置き換えられます。よろしいですか？</p>
                <div style="margin-top:1rem;">
                    <label><input type="checkbox" v-model="confirmOverwrite" /> 理解しました（全て上書き）</label>
                </div>
                <div class="dialog-buttons" style="margin-top:1rem;">
                    <button :disabled="!confirmOverwrite" @click="confirmAndSync">上書きして同期</button>
                    <button @click="cancelConfirm">キャンセル</button>
                </div>
            </dialog>

            <dialog :open="showProgressDialog" class="progress-dialog">
                <h2>同期中...</h2>
                <div class="progress-messages">
                    <div v-for="msg in syncProgress" :key="msg" class="progress-message">{{ msg }}</div>
                </div>
                <button v-if="!syncInProgress" @click="showProgressDialog = false">閉じる</button>
            </dialog>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import QuizModal from './components/quiz-modal.vue';
import { GetAllQuizzesUseCase } from '../../../model/applications/use-cases/get-all-quizzes-use-case';
import { AddQuizUseCase } from '../../../model/applications/use-cases/add-quiz-use-case';
import { UpdateQuizUseCase } from '../../../model/applications/use-cases/update-quiz-use-case';
import { DeleteQuizUseCase } from '../../../model/applications/use-cases/delete-quiz-use-case';
import { SyncQuizzesUseCase } from '../../../model/applications/use-cases/sync-quizzes-use-case';
import type { QuizDto, AddQuizDto } from '../../../model/applications/dtos/quiz-dto';

const router = useRouter();

const getAllQuizzesUseCase = container.resolve(GetAllQuizzesUseCase);
const addQuizUseCase = container.resolve(AddQuizUseCase);
const updateQuizUseCase = container.resolve(UpdateQuizUseCase);
const deleteQuizUseCase = container.resolve(DeleteQuizUseCase);
const syncQuizzesUseCase = container.resolve(SyncQuizzesUseCase);

const quizzes = ref<QuizDto[]>([]);

const showModal = ref(false);
const isEditing = ref(false);
const editingIndex = ref(-1);
const currentQuiz = ref<QuizDto>({
    id: '',
    title: '',
    question: '',
    answerUrl: '',
    timeLimit: 30,
    options: [],
    bgm: null,
});

const showSyncDialog = ref(false);
const showProgressDialog = ref(false);
const syncDirection = ref<"gas-to-local" | "local-to-gas">();
const syncProgress = ref<string[]>([]);
const syncInProgress = ref(false);
const copiedMessage = ref('');
const showConfirmDialog = ref(false);
const confirmOverwrite = ref(false);

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
        answerUrl: '',
        timeLimit: 30,
        options: [],
        bgm: null,
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
                answerUrl: quiz.answerUrl,
                timeLimit: quiz.timeLimit,
                options: quiz.options,
                bgm: quiz.bgm,
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

const selectDirection = (direction: "gas-to-local" | "local-to-gas") => {
    syncDirection.value = direction;
    showSyncDialog.value = false;
    if (direction === 'local-to-gas') {
        // require explicit confirmation for destructive action
        confirmOverwrite.value = false;
        showConfirmDialog.value = true;
        return;
    }
    showProgressDialog.value = true;
    sync();
};

const confirmAndSync = () => {
    showConfirmDialog.value = false;
    showProgressDialog.value = true;
    sync();
};

const cancelConfirm = () => {
    showConfirmDialog.value = false;
    syncDirection.value = undefined;
};

const sync = async () => {
    syncInProgress.value = true;
    syncProgress.value = [];
    try {
        const summary = await syncQuizzesUseCase.execute(syncDirection.value!, (message) => {
            syncProgress.value.push(message);
        });
        const dtos = await getAllQuizzesUseCase.execute();
        quizzes.value = dtos;
        // display concise failure summary
        if (summary) {
            syncProgress.value.push(`同期完了 — 成功: ${summary.successCount}件, 失敗: ${summary.failedCount}件`);
            if (summary.failedCount > 0) {
                const names = summary.failedFiles.slice(0, 10).join(', ');
                syncProgress.value.push(`失敗ファイル: ${names}${summary.failedCount > 10 ? ' ...' : ''}`);
            }
        } else {
            syncProgress.value.push("同期完了");
        }
    } catch (error) {
        syncProgress.value.push(`エラー: ${(error as Error).message}`);
    } finally {
        syncInProgress.value = false;
    }
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
.quiz-admin {
    min-height: 100vh;
    background-color: #111827;
    /* bg-gray-900 */
    color: white;
    font-family: system-ui, sans-serif;
}

.container {
    padding: 1.5rem;
    /* p-6 */
}

.header {
    margin-bottom: 2rem;
    /* mb-8 */
}

.title {
    font-size: 1.5rem;
    /* text-2xl */
    font-weight: bold;
    text-align: center;
    margin-bottom: 0.5rem;
    /* mb-2 */
    color: white;
}

.content {
    background-color: #1f2937;
    /* bg-gray-800 */
    border-radius: 0.5rem;
    /* rounded-lg */
    padding: 1.5rem;
    /* p-6 */
    margin-bottom: 1.5rem;
    /* mb-6 */
}

.actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    /* mb-6 */
}

.action-buttons {
    display: flex;
    align-items: center;
}

.btn-add {
    background-color: #10b981;
    /* bg-green-500 */
    color: white;
    font-weight: 600;
    /* font-semibold */
    padding: 0.5rem 1rem;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
}

.btn-add:hover {
    background-color: #059669;
    /* hover:bg-green-600 */
}

.btn-sync {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    font-weight: 600;
    /* font-semibold */
    padding: 0.5rem 1rem;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
    margin-left: 0.5rem;
}

.btn-sync:hover {
    background-color: #2563eb;
    /* hover:bg-blue-600 */
}

.count {
    color: #9ca3af;
    /* text-gray-400 */
}

.copied-message {
    color: #10b981;
    /* text-green-500 */
    font-weight: 600;
    /* font-semibold */
    margin-bottom: 1rem;
    /* mb-4 */
    text-align: center;
}

.quiz-table {
    width: 90vw;
    margin: 0 auto;
    border-collapse: collapse;
    background-color: #374151;
    /* bg-gray-700 */
    border-radius: 0.5rem;
    /* rounded-lg */
    overflow: hidden;
    border: 1px solid #4b5563;
    /* border-gray-600 */
    table-layout: fixed;
}

.table-head {
    background-color: #4b5563;
    /* bg-gray-600 */
}

.th-id {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 10%;
}

.th-title {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 35%;
}

.th-options {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 15%;
}

.th-time {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: left;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 15%;
}

.th-actions {
    padding: 0.75rem 1rem;
    /* py-3 px-4 */
    text-align: center;
    color: #d1d5db;
    /* text-gray-300 */
    font-weight: 600;
    /* font-semibold */
    border: 1px solid #6b7280;
    /* border-gray-500 */
    width: 25%;
}

.table-row {
    border-bottom: 1px solid #4b5563;
    /* border-gray-600 */
}

.table-row:hover {
    background-color: #4b5563;
    /* hover:bg-gray-650 approx */
}

.td-id {
    color: #60a5fa;
    /* text-blue-400 */
    font-family: monospace;
    font-weight: 500;
    text-align: center;
    vertical-align: middle;
    font-size: 1.125rem;
    /* text-lg */
    cursor: pointer;
}

.td-id:hover {
    color: #93c5fd;
    /* hover:text-blue-300 */
}

.td-content,
.td-options,
.td-time,
.td-actions {
    padding: 1rem;
    /* py-4 px-4 */
    border: 1px solid #6b7280;
    /* border-gray-500 */
}

.quiz-title {
    font-weight: 600;
    /* font-semibold */
    color: white;
    margin-bottom: 0.25rem;
}

.quiz-question {
    color: #9ca3af;
    /* text-gray-400 */
    font-size: 0.875rem;
    /* text-sm */
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 20rem;
    /* max-w-xs */
}

.td-options,
.td-time {
    color: #d1d5db;
    /* text-gray-300 */
}

.action-buttons {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.5rem;
    /* space-x-2 */
}

.btn-edit {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    padding: 0.5rem 0.75rem;
    min-width: 3.6rem;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 1rem;
    /* text-base */
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
    padding: 0.5rem 0.75rem;
    min-width: 3.6rem;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 1rem;
    /* text-base */
    border: none;
    cursor: pointer;
}

.btn-delete:hover {
    background-color: #dc2626;
    /* hover:bg-red-600 */
}

.btn-preview {
    background-color: #10b981;
    /* bg-green-500 */
    color: white;
    padding: 0.5rem 0.75rem;
    min-width: 3.6rem;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    font-size: 1rem;
    /* text-base */
    border: none;
    cursor: pointer;
}

.btn-preview:hover {
    background-color: #059669;
    /* hover:bg-green-600 */
}

.sync-dialog,
.progress-dialog {
    background-color: #1f2937;
    /* bg-gray-800 */
    color: white;
    border: 1px solid #4b5563;
    /* border-gray-600 */
    border-radius: 0.5rem;
    /* rounded-lg */
    padding: 1.5rem;
    /* p-6 */
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.sync-dialog h2,
.progress-dialog h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    /* text-xl */
    font-weight: bold;
}

.dialog-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
}

.sync-dialog button,
.progress-dialog button {
    background-color: #3b82f6;
    /* bg-blue-500 */
    color: white;
    padding: 0.5rem 1rem;
    /* py-2 px-4 */
    border-radius: 0.25rem;
    /* rounded */
    border: none;
    cursor: pointer;
}

.sync-dialog button:hover,
.progress-dialog button:hover {
    background-color: #2563eb;
    /* hover:bg-blue-600 */
}

.progress-messages {
    max-height: 200px;
    overflow-y: auto;
    margin-bottom: 1rem;
}

.progress-message {
    margin-bottom: 0.25rem;
    font-size: 0.875rem;
    /* text-sm */
}
</style>