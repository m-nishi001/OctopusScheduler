<template>
    <div class="member-management">
        <div class="content">
            <div class="actions">
                <button class="btn-add" @click="openAddModal">
                    メンバー追加
                </button>
                <div class="count">
                    総メンバー数: {{ members.length }}
                </div>
            </div>
            <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>
            <DataTable :columns="columns" :rows="members" row-key="userId">
                <template #cell-userId="{ value }"><span class="user-id">{{ value }}</span></template>
                <template #cell-actions="{ row }">
                    <div class="action-buttons">
                        <button class="btn-edit" @click="openEditModal(row)">編集</button>
                        <button class="btn-delete" @click="handleDelete(row.userId)">削除</button>
                    </div>
                </template>
            </DataTable>
            <p v-if="members.length === 0" class="empty-row">まだメンバーが登録されていません</p>
        </div>

        <dialog :open="showModal" class="member-dialog">
            <h2>{{ isEditing ? 'メンバー編集' : 'メンバー追加' }}</h2>
            <form class="form" @submit.prevent="handleSave">
                <div class="form-group">
                    <label class="form-label">ユーザーID</label>
                    <input v-model="formUserId" type="text" class="form-input" :disabled="isEditing" required />
                </div>
                <div class="form-group">
                    <label class="form-label">表示名</label>
                    <input v-model="formDisplayName" type="text" class="form-input" required />
                </div>
                <p v-if="formError" class="error-message">{{ formError }}</p>
                <div class="dialog-buttons">
                    <button type="submit" :disabled="isSaving">{{ isSaving ? '保存中...' : '保存' }}</button>
                    <button type="button" @click="closeModal">キャンセル</button>
                </div>
            </form>
        </dialog>
    </div>
</template>

<script setup lang="ts">
import { DataTable, type DataTableColumn } from '@octopus/ui-kit';
import { ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { MemberDirectoryRepository } from '@octopus/member-directory';
import type { Member as DirectoryMember } from '@octopus/member-directory';

/**
 * クイズの「メンバー」は共有マスタそのもの(userId = マスタのid、
 * displayName = マスタのname)。userIdは参加者ログイン時に入力する
 * 識別子であり、マスタの id をそのまま人間可読なログインコードとして使う。
 */
interface QuizMemberRow {
    userId: string;
    displayName: string;
}

function toRow(member: DirectoryMember): QuizMemberRow {
    return { userId: member.id, displayName: member.name };
}

const memberDirectoryRepo = container.resolve(MemberDirectoryRepository);

const columns: DataTableColumn[] = [
    { key: 'userId', label: 'ユーザーID' },
    { key: 'displayName', label: '表示名' },
    { key: 'actions', label: '操作' },
];

const members = ref<QuizMemberRow[]>([]);
const errorMessage = ref('');

const showModal = ref(false);
const isEditing = ref(false);
const isSaving = ref(false);
const formUserId = ref('');
const formDisplayName = ref('');
const formError = ref('');

async function loadMembers() {
    try {
        const directoryMembers = await memberDirectoryRepo.listMembers();
        members.value = directoryMembers.map(toRow);
    } catch (e) {
        errorMessage.value = 'メンバー一覧の取得に失敗しました。';
    }
}

onMounted(loadMembers);

function openAddModal() {
    isEditing.value = false;
    formUserId.value = '';
    formDisplayName.value = '';
    formError.value = '';
    showModal.value = true;
}

function openEditModal(member: QuizMemberRow) {
    isEditing.value = true;
    formUserId.value = member.userId;
    formDisplayName.value = member.displayName;
    formError.value = '';
    showModal.value = true;
}

function closeModal() {
    showModal.value = false;
}

async function handleSave() {
    const userId = formUserId.value.trim();
    const displayName = formDisplayName.value.trim();
    if (!userId || !displayName) return;

    isSaving.value = true;
    formError.value = '';
    try {
        if (isEditing.value) {
            await memberDirectoryRepo.updateMember({ id: userId, name: displayName });
        } else {
            await memberDirectoryRepo.addMember({ id: userId, name: displayName });
        }
        await loadMembers();
        closeModal();
    } catch (e) {
        formError.value = e instanceof Error ? e.message : String(e);
    } finally {
        isSaving.value = false;
    }
}

async function handleDelete(userId: string) {
    try {
        await memberDirectoryRepo.deleteMember(userId);
        await loadMembers();
    } catch (e) {
        errorMessage.value = '削除に失敗しました。';
    }
}
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
    margin-bottom: 1.5rem;
}

.btn-add {
    background-color: #10b981;
    color: white;
    font-weight: 600;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
}

.btn-add:hover {
    background-color: #059669;
}

.count {
    color: #9ca3af;
}

.error-message {
    color: #f87171;
    font-weight: 600;
    margin-bottom: 1rem;
    text-align: center;
}

.user-id {
    font-family: monospace;
}

.empty-row {
    padding: 1rem;
    text-align: center;
    color: #9ca3af;
}

.action-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
}

.btn-edit,
.btn-delete {
    color: white;
    padding: 0.35rem 0.75rem;
    border-radius: 0.25rem;
    font-size: 0.9rem;
    border: none;
    cursor: pointer;
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

.member-dialog {
    background-color: #1f2937;
    color: white;
    border: 1px solid #4b5563;
    border-radius: 0.5rem;
    padding: 1.5rem;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    width: min(420px, 90vw);
}

.member-dialog h2 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.25rem;
    font-weight: bold;
}

.form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
}

.form-group {
    display: flex;
    flex-direction: column;
}

.form-label {
    display: block;
    font-size: 0.875rem;
    font-weight: bold;
    margin-bottom: 0.375rem;
    color: #d1d5db;
}

.form-input {
    width: 100%;
    box-sizing: border-box;
    padding: 0.5rem;
    border-radius: 0.25rem;
    border: 1px solid #4b5563;
    background-color: #111827;
    color: white;
}

.form-input:focus {
    outline: none;
    box-shadow: 0 0 0 2px #3b82f6;
}

.form-input:disabled {
    opacity: 0.6;
}

.dialog-buttons {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
}

.dialog-buttons button {
    background-color: #3b82f6;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.25rem;
    border: none;
    cursor: pointer;
}

.dialog-buttons button:hover {
    background-color: #2563eb;
}

.dialog-buttons button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
}

@media (max-width: 768px) {
    .actions {
        flex-direction: column;
        align-items: flex-start;
        gap: 0.75rem;
    }
}
</style>
