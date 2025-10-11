<template>
  <div class="admin-section">
    <h2>メンバー設定</h2>
    <div class="admin-actions">
      <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal" title="Add members">
        <span class="emoji">➕</span>
      </button>
      <button class="admin-btn icon-only sync-icon" @click="syncMembers" :disabled="syncing"
        :title="'Sync with Server'">
        <span class="emoji">🔄</span>
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
        <button class="admin-btn ml-2" @click="editMember(member)">詳細</button>
        <button class="admin-btn ml-2 delete-btn" @click="deleteMember(member.id)">削除</button>
      </li>
    </ul>
    <div v-else class="empty-state">
      メンバーはいません
    </div>
  </div>

  <!-- 詳細モーダル -->
  <div v-if="editMemberData" class="modal-overlay" @click="editMemberData = null">
    <div class="modal-content" @click.stop>
      <h3>メンバー詳細</h3>
      <input v-model="editName" type="text" placeholder="名前" class="admin-input" />
      <div class="photo-mode">
        <label><input type="radio" v-model="editPhotoMode" value="upload" /> アップロード</label>
        <label><input type="radio" v-model="editPhotoMode" value="select" /> 既存から選択</label>
      </div>
      <input v-if="editPhotoMode === 'upload'" type="file" @change="onEditPhotoChange" accept="image/*"
        class="admin-input" />
      <select v-if="editPhotoMode === 'select'" v-model="editPhotoAssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
      </select>
      <div v-if="editPhotoPreview" class="admin-photo-preview">
        <img :src="editPhotoPreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="saveEdit">保存</button>
        <button class="admin-btn" @click="editMemberData = null">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 追加モーダル -->
  <div v-if="showAddModal" class="modal-overlay">
    <div class="modal-content">
      <h3>メンバーを追加</h3>
      <p>追加するメンバーの情報を入力してください。</p>
      <div class="member-input-group">
        <input v-model="newMemberName" type="text" placeholder="メンバー名" class="admin-input member-name-input" />
        <div class="photo-mode">
          <label><input type="radio" v-model="newPhotoMode" value="upload" /> アップロード</label>
          <label><input type="radio" v-model="newPhotoMode" value="select" /> 既存から選択</label>
        </div>
        <input v-if="newPhotoMode === 'upload'" type="file" @change="onNewPhotoChange" accept="image/*"
          class="admin-input" />
        <select v-if="newPhotoMode === 'select'" v-model="newPhotoAssetId" class="admin-input">
          <option value="">選択なし</option>
          <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="admin-btn" @click="confirmAdd" :disabled="!newMemberName.trim() || adding">追加</button>
        <button class="admin-btn" @click="closeAddModal" :disabled="adding">キャンセル</button>
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
import { ref, onMounted, computed } from 'vue';
import type { IMemberRepository } from '../../../model/domains/member/repository/IMemberRepository';
import { AssetDto } from "../../../../src/model/applications/asset/dto/asset-dto";
import { AssetService } from '../../../model/applications/asset/asset-service';
import { MemberService } from '../../../model/applications/member/member-service';
import { FileUtils } from '../../../../src/model/infrastructures/utils/file-utils';

import { container } from 'tsyringe';
const memberRepo = container.resolve<IMemberRepository>("IMemberRepository");
const assetService = container.resolve(AssetService);
const memberService = container.resolve(MemberService);
const members = ref<any[]>([]);
const selectedMembers = ref<string[]>([]);
const assets = ref<any[]>([]);
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));
const getMemberImageSrc = (member: any) => {
  if (member.photoAssetId) return member.photoAssetId;
  if (member.photoAsset) return member.photoAsset.dataUrl;
  return '';
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

// add modal state and actions
const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; newMemberName.value = ''; newPhotoAsset.value = undefined; newPhotoAssetId.value = ''; };
const confirmAdd = async () => { await addMember(); closeAddModal(); };

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

const newMemberName = ref('');
const newPhotoMode = ref('upload');
const newPhotoAssetId = ref('');
const newPhotoAsset = ref<AssetDto | undefined>();

const onNewPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    newPhotoAsset.value = new AssetDto({
      id: "",
      type: FileUtils.getAssetType(file.type),
      dataUrl,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: file.size
    });
  }
};

const addMember = async () => {
  if (!newMemberName.value.trim()) return;
  adding.value = true;
  const newMember: any = {
    id: String(Date.now()),
    name: newMemberName.value,
    order: members.value.length + 1
  };
  if (newPhotoMode.value === 'upload' && newPhotoAsset.value) {
    newMember.photoAsset = newPhotoAsset.value;
  } else if (newPhotoMode.value === 'select' && newPhotoAssetId.value) {
    newMember.photoAssetId = newPhotoAssetId.value;
  }
  try {
    await memberRepo.addMembers([newMember]);
    await fetchMembers();
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
    await memberRepo.deleteMembers([id]);
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
    await memberRepo.deleteMembers(selectedMembers.value);
    await fetchMembers();
    selectedMembers.value = [];
  } catch (error) {
    console.error("Failed to delete members:", error);
  } finally {
    deleting.value = false;
  }
};

const syncMembers = async () => {
  syncing.value = true;
  syncMessage.value = "";
  try {
    await memberService.syncMembers();
    await fetchMembers();
  } catch (error) {
    console.error('同期エラー:', error);
  } finally {
    syncing.value = false;
    syncMessage.value = "";
  }
};

const fetchMembers = async () => {
  try {
    members.value = await memberRepo.getMembers();
  } catch (error) {
    console.error("Failed to fetch members:", error);
    members.value = [];
  }
};

const fetchAssets = async () => {
  try {
    assets.value = await assetService.getAllAssets();
  } catch (error) {
    console.error("Failed to fetch assets:", error);
    assets.value = [];
  }
};

const editMemberData = ref<any>(null);
const editName = ref('');
const editPhotoAssetId = ref('');
const editPhotoAsset = ref<AssetDto | undefined>();
const editPhotoPreview = ref('');
const editPhotoMode = ref('upload');

const onEditPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const dataUrl = await FileUtils.readAsDataUrl(file);
    editPhotoAsset.value = new AssetDto({
      id: "",
      type: FileUtils.getAssetType(file.type),
      dataUrl,
      name: file.name,
      uploadedAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      size: file.size
    });
    editPhotoPreview.value = editPhotoAsset.value.dataUrl;
  }
};

const editMember = (member: any) => {
  editMemberData.value = member;
  editName.value = member.name;
  if (member.photoAssetId) {
    editPhotoMode.value = 'select';
    editPhotoAssetId.value = member.photoAssetId;
    editPhotoPreview.value = member.photoAssetId;
  } else {
    editPhotoMode.value = 'upload';
    editPhotoAsset.value = member.photoAsset;
    if (editPhotoAsset.value) {
      editPhotoPreview.value = editPhotoAsset.value.dataUrl || '';
    }
  }
};

const saveEdit = async () => {
  if (!editMemberData.value) return;
  const updatedMember = {
    ...editMemberData.value,
    name: editName.value
  };
  if (editPhotoMode.value === 'upload' && editPhotoAsset.value) {
    updatedMember.photoAsset = editPhotoAsset.value;
  } else if (editPhotoMode.value === 'select' && editPhotoAssetId.value) {
    updatedMember.photoAssetId = editPhotoAssetId.value;
  }
  try {
    await memberRepo.updateMembers([{ id: updatedMember.id, updateFn: () => updatedMember }]);
    await fetchMembers();
    editMemberData.value = null;
    editName.value = '';
    editPhotoAsset.value = undefined;
    editPhotoAssetId.value = '';
    editPhotoPreview.value = '';
  } catch (error) {
    console.error("Failed to update member:", error);
  }
};

onMounted(() => {
  fetchMembers();
  fetchAssets();
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
  max-width: 720px;
  width: 90%;
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
