<template>
  <div class="admin-section">
    <h2>メンバー設定</h2>
    <div class="admin-actions">
      <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openModal('add')" title="Add members">
        <span class="emoji">➕</span>
      </button>
      <button class="admin-btn icon-only delete-icon" @click="openDeleteModal"
        :disabled="!selectedMembers.length || deleting" title="Delete selected">
        <span class="emoji">🗑️</span>
      </button>
    </div>
    <div v-if="members.length" class="list-controls">
      <label class="select-all-label">
        <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
        <span class="sr-only">全選択</span>
      </label>
    </div>

    <ul v-if="members.length" class="admin-list">
      <li v-for="member in members" :key="member.id" class="admin-list-item">
        <input type="checkbox" v-model="selectedMembers" :value="member.id" />
        <div class="member-preview">
          <img v-if="member.photoAssetId || member.photoAsset" :src="getMemberImageSrc(member)" alt="photo"
            class="preview-img" />
          <span v-else>{{ member.name }}</span>
        </div>
        <div class="member-info">
          <span>{{ member.name }}</span>
        </div>
        <button class="admin-btn ml-2" @click="openModal('edit', member)">詳細</button>
        <button class="admin-btn ml-2 delete-btn" @click="deleteMember(member.id)">削除</button>
      </li>
    </ul>
    <div v-else class="empty-state">
      メンバーはいません
    </div>
  </div>

  <!-- 追加/編集モーダル -->
  <div v-if="modalMode" class="modal-overlay" @click="closeModal">
    <div class="modal-content add-modal-grid" @click.stop>
      <div class="add-form-column">
        <h3>{{ modalMode === 'edit' ? 'メンバー詳細' : 'メンバーを追加' }}</h3>
        <p v-if="modalMode === 'add'">追加するメンバーの情報を入力してください。</p>

        <div class="field-block">
          <label class="field-label">名前</label>
          <input v-model="modalName" type="text" placeholder="メンバー名" class="admin-input member-name-input" />
        </div>

        <div class="field-block">
          <label class="field-label">ランク</label>
          <input v-model.number="modalRank" type="number" placeholder="ランク" min="1" :max="modalMaxRank" step="1"
            class="admin-input" />
        </div>

        <div class="field-block">
          <label class="field-label">写真</label>
          <div class="photo-mode">
            <label><input type="radio" v-model="modalPhotoMode" value="upload" /> アップロード</label>
            <label><input type="radio" v-model="modalPhotoMode" value="select" /> 既存から選択</label>
          </div>

          <div style="margin-top:10px">
            <input v-if="modalPhotoMode === 'upload'" type="file" @change="onModalPhotoChange" accept="image/*"
              class="admin-input" />
            <div v-if="modalPhotoMode === 'upload' && modalPhotoFilename" class="file-name">{{ modalPhotoFilename }}
            </div>

            <select v-if="modalPhotoMode === 'select'" v-model="photoAssetId" class="admin-input"
              style="margin-top:8px">
              <option value="">選択なし</option>
              <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
          </div>
        </div>

      </div>

      <div class="add-side-column">
        <div class="preview-box">
          <template v-if="modalPhotoPreview">
            <img :src="modalPhotoPreview" alt="preview" class="preview-img" />
          </template>
          <template v-else>
            <div class="preview-placeholder">プレビュー</div>
          </template>
        </div>
      </div>

      <div class="modal-footer">
        <div class="admin-modal-buttons">
          <button class="admin-btn" @click="confirmModal" :disabled="!modalName.trim() || modalRank < 1 || adding">{{
            modalMode === 'add'
              ?
              '追加' : '保存' }}</button>
          <button class="admin-btn cancel-primary" @click="closeModal">キャンセル</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 削除確認モーダル -->
  <div v-if="showDeleteModal" class="modal-overlay">
    <div class="modal-content">
      <h3>メンバーを削除</h3>
      <p>選択したメンバーを削除しますか？</p>
      <div class="modal-actions">
        <button class="admin-btn delete-btn" @click="confirmDeleteSelected">削除</button>
        <button class="admin-btn" @click="closeDeleteModal">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 削除中モーダル -->
  <div v-if="deleting" class="modal-overlay">
    <div class="modal-content">
      <h3>削除中...</h3>
      <p>{{ deleteMessage }}</p>
      <div class="spinner"></div>
    </div>
  </div>

  <!-- 同期中モーダル -->
  <div v-if="syncing" class="modal-overlay">
    <div class="modal-content">
      <h3>サーバーと同期中...</h3>
      <p>{{ syncMessage || "メンバーを同期しています。しばらくお待ちください。" }}</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed, watch, onBeforeUnmount } from 'vue';
import type { IMemberRepository } from '../../../model/domains/member/repository/i-member-repository';
import { DriveDataDto } from '../../../model/applications/asset/dto/drive-data-dto';
import { DriveDataService } from '../../../model/applications/asset/drive-data-service';
import { MemberAddService } from '../../../model/applications/member/member-add-service';
import { MemberDeleteService } from '../../../model/applications/member/member-delete-service';
import type { MemberDto } from "../../../model/applications/member/dto/member-dto";

import { container } from 'tsyringe';
const memberRepo = container.resolve<IMemberRepository>("IMemberRepository");
const driveDataService = container.resolve<DriveDataService>("DriveDataService");
const memberAddService = container.resolve<MemberAddService>(MemberAddService);
const memberDeleteService = container.resolve<MemberDeleteService>(MemberDeleteService);
const members = ref<any[]>([]);
const selectedMembers = ref<string[]>([]);
const assets = ref<DriveDataDto[]>([]);
const imageAssets = computed(() => assets.value.filter((asset) => ((asset as any).blob as Blob).type.startsWith('image')));
const getMemberImageSrc = (member: any) => {
  return member.photoDataUrl || '';
};

const isAllSelected = computed({
  get: () => {
    return members.value.length > 0 && selectedMembers.value.length === members.value.length;
  },
  set: (val: boolean) => {
    if (val) {
      selectedMembers.value = members.value.map(m => m.id);
    } else {
      selectedMembers.value = [];
    }
  }
});

// modal state
const modalMode = ref<'add' | 'edit' | null>(null);
const modalData = ref<any>(null);
const modalName = ref('');
const modalRank = ref(1);
const modalMaxRank = ref(1);
const modalPhotoMode = ref('upload');
const modalPhotoAsset = ref<DriveDataDto | undefined>();
const modalPhotoPreview = ref('');
let modalPhotoPreviewUrl: string | undefined;
const modalPhotoFilename = ref('');
const photoAssetId = ref('');
const tempAsset = ref<DriveDataDto | null>(null);

// modal actions
const openModal = (mode: 'add' | 'edit', data?: any) => {
  modalMode.value = mode;
  modalData.value = data || null;
  if (mode === 'add') {
    modalName.value = '';
    modalRank.value = members.value.length + 1;
    modalMaxRank.value = 10;
    modalPhotoMode.value = 'upload';
    modalPhotoAsset.value = undefined;
    modalPhotoPreview.value = '';
    modalPhotoFilename.value = '';
    photoAssetId.value = '';
    tempAsset.value = null;
  } else if (mode === 'edit' && data) {
    modalName.value = data.name;
    modalRank.value = data.rank;
    modalMaxRank.value = 10;
    if (data.photoAssetId) {
      modalPhotoMode.value = 'select';
      photoAssetId.value = data.photoAssetId;
      modalPhotoPreview.value = data.photoDataUrl || '';
    } else {
      modalPhotoMode.value = 'upload';
      modalPhotoAsset.value = data.photoAsset;
      if (modalPhotoAsset.value) {
        modalPhotoPreview.value = modalPhotoAsset.value.dataUrl || '';
      }
    }
  }
};
const closeModal = () => {
  modalMode.value = null;
  modalData.value = null;
  modalName.value = '';
  modalRank.value = 1;
  modalMaxRank.value = 1;
  modalPhotoAsset.value = undefined;
  modalPhotoPreview.value = '';
  modalPhotoFilename.value = '';
  photoAssetId.value = '';
  tempAsset.value = null;
};
const confirmModal = async () => {
  if (modalMode.value === 'add') {
    await addMember();
  } else if (modalMode.value === 'edit') {
    if (!modalData.value) return;
    const updatedMember = {
      ...modalData.value,
      name: modalName.value,
      rank: modalRank.value
    };
    if (modalPhotoMode.value === 'upload' && modalPhotoAsset.value) {
      updatedMember.photoAsset = modalPhotoAsset.value;
    } else if (modalPhotoMode.value === 'select' && photoAssetId.value) {
      updatedMember.photoAssetId = photoAssetId.value;
    }
    try {
      await memberRepo.updateMembers([{ id: updatedMember.id, updateFn: () => updatedMember }]);
      await fetchMembers();
    } catch (error) {
      console.error("Failed to update member:", error);
    }
  }
  closeModal();
};

// delete modal state
const showDeleteModal = ref(false);
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; };
const confirmDeleteSelected = async () => { await deleteSelectedMembers(); closeDeleteModal(); };

// status
const adding = ref(false);
const deleting = ref(false);
const deleteMessage = ref("");
const syncing = ref(false);
const syncMessage = ref("");

const updateModalPhotoPreview = async () => {
  // revoke previous preview url if any
  if (modalPhotoPreviewUrl) {
    try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { }
    modalPhotoPreviewUrl = undefined;
  }

  if (modalPhotoAsset.value && (modalPhotoAsset.value as any).blob) {
    modalPhotoPreviewUrl = URL.createObjectURL((modalPhotoAsset.value as any).blob as Blob);
    modalPhotoPreview.value = modalPhotoPreviewUrl;
  } else if (modalPhotoAsset.value && modalPhotoAsset.value.dataUrl) {
    // fallback to dataUrl only when blob not available
    modalPhotoPreview.value = modalPhotoAsset.value.dataUrl;
  } else if (photoAssetId.value) {
    const asset = await driveDataService.getDriveDataById(photoAssetId.value);
    if (asset && (asset as any).blob) {
      modalPhotoPreviewUrl = URL.createObjectURL((asset as any).blob as Blob);
      modalPhotoPreview.value = modalPhotoPreviewUrl;
    } else {
      modalPhotoPreview.value = asset?.dataUrl || '';
    }
  } else {
    modalPhotoPreview.value = '';
  }
};

const onModalPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    // returns { dto, blob }
    const result = await driveDataService.createDriveDataDtoWithBlobFromFile(file);
    tempAsset.value = result.dto;
    modalPhotoAsset.value = result.dto;
    modalPhotoFilename.value = file.name;

    // revoke previous
    if (modalPhotoPreviewUrl) {
      try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { };
    }
    modalPhotoPreviewUrl = URL.createObjectURL(result.blob);
    modalPhotoPreview.value = modalPhotoPreviewUrl;
  }
};

onBeforeUnmount(() => {
  if (modalPhotoPreviewUrl) {
    try { URL.revokeObjectURL(modalPhotoPreviewUrl); } catch { };
    modalPhotoPreviewUrl = undefined;
  }
});

const addMember = async () => {
  if (!modalName.value.trim()) return;
  adding.value = true;
  const newMember: MemberDto = {
    id: "",
    name: modalName.value,
    rank: modalRank.value,
    photoAssetId: photoAssetId.value || undefined
  };
  try {
    const addedMember = await memberAddService.saveMember(newMember, tempAsset.value || undefined);
    members.value.push(addedMember);
  } catch (error) {
    console.error("Failed to add member:", error);
  } finally {
    adding.value = false;
  }
};

const deleteMember = async (id: string) => {
  deleting.value = true;
  deleteMessage.value = "メンバーを削除しています...";
  try {
    await memberDeleteService.deleteMember(id);
    await fetchMembers();
  } catch (error) {
    console.error("Failed to delete member:", error);
  } finally {
    deleting.value = false;
  }
};

const deleteSelectedMembers = async () => {
  if (!selectedMembers.value.length) return;
  deleting.value = true;
  deleteMessage.value = "メンバーを削除しています...";
  try {
    await memberDeleteService.deleteMembers(selectedMembers.value);
    await fetchMembers();
    selectedMembers.value = [];
  } catch (error) {
    console.error("Failed to delete members:", error);
  } finally {
    deleting.value = false;
  }
};

const fetchMembers = async () => {
  try {
    const fetchedMembers = await memberRepo.getMembers();
    for (const member of fetchedMembers) {
      if (member.photoAssetId) {
        const asset = await driveDataService.getDriveDataById(member.photoAssetId);
        member.photoDataUrl = asset?.dataUrl;
      }
    }
    members.value = fetchedMembers;
  } catch (error) {
    console.error("Failed to fetch members:", error);
    members.value = [];
  }
};

const fetchAssets = async () => {
  try {
    assets.value = await driveDataService.getAllDriveData();
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    assets.value = [];
  }
};

onMounted(async () => {
  await fetchMembers();
  await fetchAssets();
});

watch(photoAssetId, async () => {
  await updateModalPhotoPreview();
});

watch(modalPhotoMode, () => {
  if (modalPhotoMode.value === 'select') {
    tempAsset.value = null;
  }
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

.list-controls {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.select-all-checkbox {
  width: 20px;
  height: 20px;
  margin: 0;
  vertical-align: middle;
}

.select-all-label {
  margin-left: 10px;
}

.admin-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.admin-list-item {
  background: #232b36;
  color: #fff;
  padding: 14px;
  border-radius: 10px;
  margin-bottom: 12px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
  display: grid;
  grid-template-columns: 36px 110px 1fr auto auto;
  gap: 14px;
  align-items: center;
}

.admin-list-item input[type="checkbox"] {
  width: 20px;
  height: 20px;
  justify-self: center;
}

.member-preview {
  width: 110px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #2a3137;
  border-radius: 6px;
  overflow: hidden;
}

.preview-img {
  max-width: 100%;
  max-height: 100%;
  display: block;
}

.member-info {
  min-width: 0;
}

.ml-2 {
  margin-left: 8px;
}

.empty-state {
  text-align: center;
  color: #c9d7e6;
  font-size: 1.1rem;
  padding: 40px;
}

.admin-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.98rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
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

.delete-btn {
  background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
  box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
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

.sync-icon {
  /* visually distinct but subtle */
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
  color: #dbeeff;
}

.sync-icon .emoji {
  font-weight: 700;
}

.icon-only .emoji,
.add-icon .emoji {
  font-size: 20px;
  line-height: 1;
}

.sr-only {
  position: absolute !important;
  height: 1px;
  width: 1px;
  overflow: hidden;
  clip: rect(1px, 1px, 1px, 1px);
  white-space: nowrap;
  border: 0;
  padding: 0;
  margin: -1px;
}

.photo-mode {
  display: flex;
  gap: 16px;
}

.photo-mode label {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fff;
}

.member-input-group {
  display: flex;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.member-name-input {
  flex: 1;
  min-width: 200px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #232b36;
  color: #fff;
  padding: 28px;
  border-radius: 10px;
  text-align: left;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
  max-width: 620px;
  width: 90%;
}

.add-modal-grid {
  display: grid;
  grid-template-columns: 1fr 260px;
  gap: 12px;
  align-items: start;
  margin-top: 12px;
}

.add-form-column .field-label {
  display: block;
  margin-bottom: 8px;
  color: #cfe8ff;
  font-weight: 600;
}

.field-block {
  margin-top: 12px;
}

.add-side-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
}

.photo-mode.vertical {
  flex-direction: column;
  gap: 8px;
}

.preview-box {
  width: 240px;
  height: 240px;
  background: #2a3137;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-box .preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.preview-placeholder {
  color: #9fb8db
}

.file-name {
  margin-top: 8px;
  color: #cfe8ff;
  font-size: 0.92rem;
}

.cancel-primary {
  background: #3b4650;
  color: #fff;
}

.modal-footer {
  grid-column: 1 / -1;
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.modal-actions {
  margin-top: 16px;
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 18px;
}

.spinner {
  margin: 16px auto;
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #4f8cff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
</style>
