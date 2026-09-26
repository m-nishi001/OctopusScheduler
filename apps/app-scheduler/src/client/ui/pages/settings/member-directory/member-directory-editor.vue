<template>
    <div class="admin-section">
        <h2 class="editor-title"><span class="editor-icon">👥</span> メンバーマスタ管理</h2>
        <p class="editor-description">
            ここで登録したメンバーは、各ゲーム(ジャックポット・クイズなど)の管理画面から共通の名簿として参照できます。
        </p>

        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openModal('add')"
                title="Add member">➕</button>
            <button class="admin-btn icon-only delete-icon" @click="showDeleteModal = true"
                :disabled="!selectedMembers.length || deleting" title="Delete selected">🗑️</button>
        </div>

        <ul v-if="members.length" class="admin-list">
            <li class="admin-list-header" aria-hidden="true">
                <div class="header-checkbox">
                    <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
                </div>
                <div class="header-id">ID</div>
                <div class="header-name">名前</div>
                <div class="header-actions">操作</div>
            </li>
            <li v-for="member in members" :key="member.id" class="admin-list-item">
                <div class="row-checkbox">
                    <input type="checkbox" v-model="selectedMembers" :value="member.id" />
                </div>
                <div class="member-id">{{ member.id }}</div>
                <div class="member-name">{{ member.name }}</div>
                <div class="member-actions">
                    <button class="admin-btn" @click="openModal('edit', member)">編集</button>
                    <button class="admin-btn delete-btn" @click="deleteMember(member.id)">削除</button>
                </div>
            </li>
        </ul>

        <div v-else class="empty-state">メンバーはいません</div>
    </div>

    <MemberFormDialog v-if="modalMode" :mode="modalMode" :member="modalData" @submit="onFormSubmit"
        @cancel="closeModal" />

    <MemberDeleteDialog v-if="showDeleteModal || deleting" :deleting="deleting" :delete-message="deleteMessage"
        @confirm="onConfirmDelete" @cancel="showDeleteModal = false" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { Member } from '@octopus/member-directory';
import { useMemberDirectory } from './use-member-directory';
import type { MemberFormInput } from './use-member-directory';
import MemberFormDialog from './components/member-form-dialog.vue';
import MemberDeleteDialog from './components/member-delete-dialog.vue';

const {
    members,
    selectedMembers,
    isAllSelected,
    deleting,
    deleteMessage,
    fetchMembers,
    addMember,
    updateMember,
    deleteMember,
    deleteSelectedMembers,
} = useMemberDirectory();

const modalMode = ref<'add' | 'edit' | null>(null);
const modalData = ref<Member | null>(null);
const openModal = (mode: 'add' | 'edit', data?: Member) => {
    modalMode.value = mode;
    modalData.value = data || null;
};
const closeModal = () => {
    modalMode.value = null;
    modalData.value = null;
};

const onFormSubmit = async (input: MemberFormInput) => {
    if (modalMode.value === 'add') {
        await addMember(input);
    } else if (modalMode.value === 'edit' && modalData.value) {
        await updateMember(modalData.value, input);
    }
    closeModal();
};

const showDeleteModal = ref(false);
const onConfirmDelete = async () => {
    await deleteSelectedMembers();
    showDeleteModal.value = false;
};

onMounted(async () => {
    await fetchMembers();
});
</script>

<style scoped>
.admin-section {
    margin-bottom: 32px;
}

.editor-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
}

.editor-icon {
    font-size: 1.3em;
}

.editor-description {
    color: rgba(255, 255, 255, 0.7);
    margin: 0 0 28px 0;
}

.admin-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 18px;
}

.admin-actions .admin-btn.icon-only {
    width: 48px;
    height: 48px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    border-radius: 12px;
    background: transparent;
    color: #cfe8ff;
    border: 1px solid rgba(255, 255, 255, 0.04);
}

.admin-actions .admin-btn.icon-only:hover {
    background: rgba(255, 255, 255, 0.02);
}

.admin-actions .admin-btn.icon-only:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.admin-list {
    list-style: none;
    padding: 28px 28px;
    margin: 8px 0 0 0;
    display: table;
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(0, 0, 0, 0.6) inset;
    border-radius: 14px;
    overflow: hidden;
}

.admin-list-header {
    display: table-row;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 700;
    font-size: 1.12rem;
    background: rgba(255, 255, 255, 0.003);
}

.admin-list-item {
    display: table-row;
    border-radius: 0;
    border: none;
    background: transparent;
}

.admin-list-item+.admin-list-item {
    border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.admin-list-item:hover {
    background: rgba(255, 255, 255, 0.01);
}

.admin-list-header>div,
.admin-list-item>* {
    display: table-cell;
    vertical-align: middle;
    padding: 20px 24px;
}

.admin-list-header>div {
    border-bottom: 1px solid rgba(255, 255, 255, 0.20);
    text-align: center;
}

.header-id,
.header-name {
    text-align: left;
}

.header-checkbox,
.row-checkbox {
    width: 48px;
    text-align: center;
}

.header-id,
.member-id {
    width: 240px;
    color: rgba(255, 255, 255, 0.6);
    font-family: monospace;
}

.header-name,
.member-name {
    width: auto;
    font-size: 1.1rem;
    font-weight: 600;
}

.header-actions {
    width: 200px;
    text-align: right;
}

.member-id,
.member-name,
.member-actions,
.header-id,
.header-name,
.header-actions {
    border-left: 1px solid rgba(255, 255, 255, 0.26);
}

.member-actions {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
}

.admin-list-item input[type="checkbox"],
.admin-list-header .select-all-checkbox {
    width: 20px;
    height: 20px;
    display: block;
    margin: 0 auto;
}

.admin-btn {
    padding: 9px 18px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: 700;
    cursor: pointer;
    transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.admin-btn:hover {
    box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
}

.delete-btn {
    background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
    box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
}

.empty-state {
    text-align: center;
    color: #c9d7e6;
    font-size: 1.1rem;
    padding: 40px;
}
</style>
