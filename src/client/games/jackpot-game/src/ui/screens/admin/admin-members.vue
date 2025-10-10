<template>
  <div class="admin-section">
    <h2>メンバー設定</h2>
    <form class="admin-form" @submit.prevent="addMembers">
      <div class="member-input-group">
        <input v-model="memberName" type="text" placeholder="メンバー名" class="admin-input member-name-input" />
        <div class="photo-mode">
          <label><input type="radio" v-model="photoMode" value="upload" /> アップロード</label>
          <label><input type="radio" v-model="photoMode" value="select" /> 既存から選択</label>
        </div>
        <input v-if="photoMode === 'upload'" type="file" @change="onPhotoChange" accept="image/*" class="admin-input" />
        <select v-if="photoMode === 'select'" v-model="photoAssetId" class="admin-input">
          <option value="">選択なし</option>
          <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
        </select>
        <button type="submit" class="admin-btn" :disabled="!memberName.trim()">追加</button>
      </div>
    </form>
    <div class="admin-actions">
      <button class="admin-btn delete-btn" @click="deleteSelectedMembers"
        :disabled="!selectedMembers.length">選択したメンバーを削除</button>
      <button class="admin-btn delete-all-btn" @click="deleteAllMembers"
        :disabled="!members.length || deleteAllDeleting">全件削除</button>
    </div>
    <ul class="admin-list">
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
        <button class="admin-btn" @click="editMember(member)">詳細</button>
      </li>
    </ul>
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

  <!-- 全件削除モーダル -->
  <div v-if="deleteAllDeleting" class="modal-overlay">
    <div class="modal-content">
      <h3>全件削除中...</h3>
      <p>{{ deleteAllMessage }}</p>
      <div class="spinner"></div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { IMemberRepository } from '../../../model/domains/member/repository/IMemberRepository';
import { AssetDto } from '../../../model/applications/asset/dto/asset-dto';
import { AssetService } from '../../../model/applications/asset/asset-service';

import { container } from 'tsyringe';
const memberRepo = container.resolve<IMemberRepository>("IMemberRepository");
const assetService = container.resolve(AssetService);
const members = ref<any[]>([]);
const selectedMembers = ref<string[]>([]);
const assets = ref<any[]>([]);
const photoMode = ref('upload');
const editPhotoMode = ref('upload');
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));
const getMemberImageSrc = (member: any) => {
  if (member.photoAssetId) return member.photoAssetId;
  if (member.photoAsset) return member.photoAsset.dataUrl;
  return '';
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

const memberName = ref('');
const photoAssetId = ref('');
const photoAsset = ref<AssetDto | undefined>();
const onPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    photoAsset.value = new AssetDto(file);
  }
};

const addMembers = async () => {
  if (!memberName.value.trim()) return;
  const newMember: any = {
    id: String(Date.now()),
    name: memberName.value,
    order: members.value.length + 1
  };
  if (photoMode.value === 'upload' && photoAsset.value) {
    newMember.photoAsset = photoAsset.value;
  } else if (photoMode.value === 'select' && photoAssetId.value) {
    newMember.photoAssetId = photoAssetId.value;
  }
  try {
    await memberRepo.addMembers([newMember]);
    await fetchMembers();
    memberName.value = '';
    photoAsset.value = undefined;
    photoAssetId.value = '';
  } catch (error) {
    console.error("Failed to add member:", error);
  }
};

const deleteSelectedMembers = async () => {
  if (!selectedMembers.value.length) return;
  try {
    await memberRepo.deleteMembers(selectedMembers.value);
    await fetchMembers();
    selectedMembers.value = [];
  } catch (error) {
    console.error("Failed to delete members:", error);
  }
};

const deleteAllDeleting = ref(false);
const deleteAllMessage = ref('');

const deleteAllMembers = async () => {
  if (!members.value.length) return;
  deleteAllDeleting.value = true;
  deleteAllMessage.value = 'メンバーを削除しています...';
  try {
    await memberRepo.deleteMembers(members.value.map(m => m.id));
    await fetchMembers();
  } catch (error) {
    console.error("Failed to delete all members:", error);
  } finally {
    deleteAllDeleting.value = false;
  }
};

const editMemberData = ref<any>(null);
const editName = ref('');
const editPhotoAssetId = ref('');
const editPhotoAsset = ref<AssetDto | undefined>();
const editPhotoPreview = ref('');

const onEditPhotoChange = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    editPhotoAsset.value = new AssetDto(file);
    editPhotoPreview.value = await editPhotoAsset.value.dataUrl;
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
      editPhotoAsset.value.dataUrl.then(url => editPhotoPreview.value = url);
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

.admin-form {
  margin-bottom: 24px;
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

.admin-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.admin-list {
  list-style: none;
  padding: 0;
}

.admin-list-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #232b36;
  border-radius: 8px;
  margin-bottom: 8px;
}

.member-preview {
  width: 60px;
  height: 60px;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #333;
}

.preview-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.member-info {
  flex: 1;
  color: #fff;
}

.admin-input {
  padding: 10px 16px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 1rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

.admin-btn {
  padding: 10px 24px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: bold;
  cursor: pointer;
  transition: background 0.2s;
}

.admin-btn:hover {
  background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.admin-btn.delete-btn {
  background: linear-gradient(90deg, #ff4f4f 0%, #ffaeae 100%);
}

.admin-btn.delete-btn:hover {
  background: linear-gradient(90deg, #ffaeae 0%, #ff4f4f 100%);
}

.admin-btn.delete-all-btn {
  background: linear-gradient(90deg, #ff4f4f 0%, #ffaeae 100%);
}

.admin-btn.delete-all-btn:hover {
  background: linear-gradient(90deg, #ffaeae 0%, #ff4f4f 100%);
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
  text-align: center;
  box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
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
