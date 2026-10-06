<template>
  <div class="admin-section">
    <UiToolbar>
      <UiButton variant="primary" icon="add" @click.prevent="openModal('add')">追加</UiButton>
      <UiButton variant="danger" icon="delete" :disabled="!selectedMembers.length || deleting"
        @click="showDeleteModal = true">選択を外す</UiButton>
      <UiButton icon="file" @click.prevent="exportFormatCsv">書式CSV</UiButton>
      <UiButton icon="upload" @click.prevent="showDataUploadDialog = true">データ取込</UiButton>
    </UiToolbar>

    <MemberList :members="members" v-model:selected="selectedMembers" :get-member-image-src="getMemberImageSrc"
      @edit="(member) => openModal('edit', member)" @delete="deleteMember" />
  </div>

  <MemberFormDialog v-if="modalMode" :mode="modalMode" :member="modalData" :image-assets="imageAssets"
    :existing-directory-members="availableDirectoryMembers" @submit="onFormSubmit" @cancel="closeModal" />

  <MemberDeleteDialog v-if="showDeleteModal || deleting" :deleting="deleting" :delete-message="deleteMessage"
    @confirm="onConfirmDelete" @cancel="showDeleteModal = false" />

  <DataUploadDialog v-if="showDataUploadDialog" :show="showDataUploadDialog" type="member"
    @close="showDataUploadDialog = false" @refresh="fetchMembers" />
</template>

<script setup lang="ts">
import { UiButton, UiToolbar } from '@octopus/ui-kit';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';
import { container } from 'tsyringe';
import { useMembers } from './use-members';
import type { MemberFormInput } from './use-members';
import MemberList from './components/member-list.vue';
import MemberFormDialog from './components/member-form-dialog.vue';
import MemberDeleteDialog from './components/member-delete-dialog.vue';
import DataUploadDialog from './components/data-upload-dialog.vue';

const assetDataService = container.resolve(AssetDataService);

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
  disposeObjectUrls,
} = useMembers();

const assets = ref<Asset[]>([]);
const imageAssets = computed(() => assets.value.filter((asset) => asset.blob.type.startsWith('image')));
const fetchAssets = async () => {
  try {
    assets.value = await assetDataService.getAllAssetData();
  } catch (error) {
    console.error('Failed to fetch assets:', error);
    assets.value = [];
  }
};

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

onMounted(async () => {
  await fetchMembers();
  await fetchAssets();
});

onBeforeUnmount(() => {
  disposeObjectUrls();
});
</script>
