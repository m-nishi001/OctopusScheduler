<template>
  <div class="admin-section">
    <h2>メンバー詳細設定(ランク・写真)</h2>
    <div class="admin-actions">
      <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openModal('add')" title="Add members">
        <span class="emoji">➕</span>
      </button>
      <button class="admin-btn icon-only delete-icon" @click="showDeleteModal = true"
        :disabled="!selectedMembers.length || deleting" title="Delete selected">
        <span class="emoji">🗑️</span>
      </button>
      <button type="button" class="admin-btn icon-only export-icon" @click.prevent="exportFormatCsv"
        title="Export format CSV">
        <span class="emoji">📄</span>
      </button>
      <button type="button" class="admin-btn icon-only upload-icon" @click.prevent="showDataUploadDialog = true"
        title="Upload data">
        <span class="emoji">📤</span>
      </button>
    </div>

    <MemberList :members="members" v-model:selected="selectedMembers" v-model:is-all-selected="isAllSelected"
      :get-member-image-src="getMemberImageSrc" @edit="(member) => openModal('edit', member)" @delete="deleteMember" />
  </div>

  <MemberFormDialog v-if="modalMode" :mode="modalMode" :member="modalData" :image-assets="imageAssets"
    :existing-directory-members="availableDirectoryMembers" @submit="onFormSubmit" @cancel="closeModal" />

  <MemberDeleteDialog v-if="showDeleteModal || deleting" :deleting="deleting" :delete-message="deleteMessage"
    @confirm="onConfirmDelete" @cancel="showDeleteModal = false" />

  <DataUploadDialog v-if="showDataUploadDialog" :show="showDataUploadDialog" type="member"
    @close="showDataUploadDialog = false" @refresh="fetchMembers" />
</template>

<script setup lang="ts">
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
  isAllSelected,
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

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.admin-actions {
  margin-bottom: 18px;
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
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

.admin-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.icon-only {
  padding: 8px;
  border-radius: 8px;
  background: transparent;
  color: #cfe8ff;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.icon-only:hover {
  background: rgba(255, 255, 255, 0.02);
}

.add-icon {
  padding: 10px;
  border-radius: 12px;
  background: linear-gradient(180deg, #b6d8ff 0%, #8aaeff 100%);
  color: #232b36;
  border: none;
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.12);
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.add-icon:hover {
  transform: translateY(-2px);
}

.icon-only .emoji,
.add-icon .emoji {
  font-size: 20px;
  line-height: 1;
}
</style>
