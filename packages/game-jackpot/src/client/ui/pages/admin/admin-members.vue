<template>
  <div class="admin-section">
    <UiToolbar>
      <UiButton variant="primary" icon="add" @click.prevent="openModal('add')">追加</UiButton>
      <UiButton variant="danger" icon="delete" :disabled="!selectedMembers.length || deleting"
        @click="showDeleteModal = true">選択の設定を初期値に戻す</UiButton>
      <UiButton icon="file" @click.prevent="exportFormatCsv">書式CSV</UiButton>
      <UiButton icon="upload" @click.prevent="showDataUploadDialog = true">データ取込</UiButton>
    </UiToolbar>

    <MemberList :members="members" v-model:selected="selectedMembers" :get-member-image-src="getMemberImageSrc"
      @edit="(member) => openModal('edit', member)" @delete="deleteMember" />
  </div>

  <MemberFormDialog v-if="modalMode" :mode="modalMode" :member="modalData"
    :existing-directory-members="availableDirectoryMembers" @submit="onFormSubmit" @cancel="closeModal" />

  <MemberDeleteDialog v-if="showDeleteModal || deleting" :deleting="deleting" :delete-message="deleteMessage"
    @confirm="onConfirmDelete" @cancel="showDeleteModal = false" />

  <DataUploadDialog v-if="showDataUploadDialog" :show="showDataUploadDialog" type="member"
    @close="showDataUploadDialog = false" @refresh="fetchMembers" />
</template>

<script setup lang="ts">
import { UiButton, UiToolbar } from '@octopus/ui-kit';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { useMembers } from './use-members';
import type { MemberFormInput } from './use-members';
import MemberList from './components/member-list.vue';
import MemberFormDialog from './components/member-form-dialog.vue';
import MemberDeleteDialog from './components/member-delete-dialog.vue';
import DataUploadDialog from './components/data-upload-dialog.vue';

const {
  members,
  availableDirectoryMembers,
  selectedMembers,
  deleting,
  deleteMessage,
  getMemberImageSrc,
  fetchMembers,
  addMember,
  updateMember,
  deleteMember,
  deleteSelectedMembers,
  exportFormatCsv,
} = useMembers();

const modalMode = ref<'add' | 'edit' | null>(null);
const modalData = ref<any>(null);
const openModal = (mode: 'add' | 'edit', data?: any) => {
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

const showDataUploadDialog = ref(false);

// 初めて開くブラウザでは、表示した後の背景同期でサーバーのデータが取り込まれる。取り込み完了時に一覧を読み直す
const reloadAfterSync = () => {
  void fetchMembers();
};

onMounted(async () => {
  eventBus.on('syncPulled', reloadAfterSync);
  await fetchMembers();
});

onBeforeUnmount(() => {
  eventBus.off('syncPulled', reloadAfterSync);
});
</script>
