<template>
  <button class="admin-btn mt-4" @click="saveMembers">保存</button>
  <div class="admin-section">
    <h2>メンバー管理</h2>
    <div class="admin-controls">
      <select v-model="sortBy" @change="sortMembers" class="admin-input">
        <option value="name">名前順</option>
        <option value="order">追加順</option>
      </select>
      <button class="admin-btn" @click="showAddModal = true">追加</button>
      <button class="admin-btn" @click="bulkDelete" :disabled="selectedMembers.length === 0">一括削除</button>
    </div>
    <div class="admin-grid">
      <div v-for="(member, idx) in members" :key="member.id" class="admin-card">
        <input type="checkbox" v-model="selectedMembers" :value="idx" class="admin-checkbox" />
        <div class="admin-card-content">
          <img v-if="member.photoAssetId || member.photoUrl" :src="member.photoAssetId || member.photoUrl" alt="photo"
            class="admin-thumbnail" />
          <div v-else class="admin-thumbnail-placeholder">No Image</div>
          <h3>{{ member.name }}</h3>
          <button class="admin-btn" @click="editMember(idx)">編集</button>
        </div>
      </div>
    </div>
  </div>

  <!-- 追加モーダル -->
  <div v-if="showAddModal" class="admin-modal" @click="showAddModal = false">
    <div class="admin-modal-content" @click.stop>
      <h3>メンバー追加</h3>
      <input v-model="memberName" type="text" placeholder="名前" class="admin-input" />
      <input type="file" @change="onPhotoChange" accept="image/*" class="admin-input" />
      <div v-if="photoPreview" class="admin-photo-preview">
        <img :src="photoPreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="addMember">追加</button>
        <button class="admin-btn" @click="showAddModal = false">キャンセル</button>
      </div>
    </div>
  </div>

  <!-- 編集モーダル -->
  <div v-if="editIdx !== null" class="admin-modal" @click="editIdx = null">
    <div class="admin-modal-content" @click.stop>
      <h3>メンバー編集</h3>
      <input v-model="editName" type="text" placeholder="名前" class="admin-input" />
      <input type="file" @change="onEditPhotoChange" accept="image/*" class="admin-input" />
      <div v-if="editPhotoPreview" class="admin-photo-preview">
        <img :src="editPhotoPreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <div class="admin-modal-buttons">
        <button class="admin-btn" @click="saveEdit">保存</button>
        <button class="admin-btn" @click="editIdx = null">キャンセル</button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MemberService } from '../../../model/applications/member-service';

import { container } from 'tsyringe';
const memberService = container.resolve(MemberService);
const members = ref<any[]>([]);
const originalMembers = ref<any[]>([]);
const selectedMembers = ref<number[]>([]);
const sortBy = ref('name');
const showAddModal = ref(false);
const isMemberChanged = (member: any, original: any) => {
  return JSON.stringify(member) !== JSON.stringify(original);
};
const saveMembers = async () => {
  for (let i = 0; i < members.value.length; i++) {
    const member = members.value[i];
    const original = originalMembers.value[i];
    if (!original || isMemberChanged(member, original)) {
      if (!original) {
        await memberService.addMember(member);
      } else {
        await memberService.updateMember(member);
      }
      originalMembers.value[i] = JSON.parse(JSON.stringify(member));
    }
  }
};
const fetchMembers = async () => {
  members.value = await memberService.fetchMembers();
  originalMembers.value = JSON.parse(JSON.stringify(members.value));
  sortMembers();
};
const sortMembers = () => {
  if (sortBy.value === 'name') {
    members.value.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy.value === 'order') {
    members.value.sort((a, b) => a.order - b.order);
  }
};
const bulkDelete = () => {
  selectedMembers.value.sort((a, b) => b - a);
  for (const idx of selectedMembers.value) {
    members.value.splice(idx, 1);
  }
  selectedMembers.value = [];
};
const memberName = ref('');
const photoAssetId = ref('');
const photoPreview = ref('');
const onPhotoChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoPreview.value = ev.target?.result as string;
      photoAssetId.value = photoPreview.value;
    };
    reader.readAsDataURL(file);
  }
};
const addMember = () => {
  if (!memberName.value) return;
  members.value.push({
    id: String(Date.now()),
    name: memberName.value,
    photoAssetId: photoAssetId.value,
    order: members.value.length + 1
  });
  memberName.value = '';
  photoAssetId.value = '';
  photoPreview.value = '';
  showAddModal.value = false;
  sortMembers();
};
const editIdx = ref<number | null>(null);
const editName = ref('');
const editPhotoAssetId = ref('');
const editPhotoPreview = ref('');
const onEditPhotoChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editPhotoPreview.value = ev.target?.result as string;
      editPhotoAssetId.value = editPhotoPreview.value;
    };
    reader.readAsDataURL(file);
  }
};
const editMember = (idx: number) => {
  editIdx.value = idx;
  const member = members.value[idx];
  editName.value = member.name;
  editPhotoAssetId.value = member.photoAssetId || '';
  editPhotoPreview.value = member.photoAssetId || '';
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  members.value[editIdx.value] = {
    name: editName.value,
    photoAssetId: editPhotoAssetId.value,
    order: members.value[editIdx.value].order
  } as any;
  editIdx.value = null;
  editName.value = '';
  editPhotoAssetId.value = '';
  editPhotoPreview.value = '';
  sortMembers();
};

onMounted(() => {
  fetchMembers();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.admin-controls {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  align-items: center;
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

.admin-btn:disabled {
  background: #555;
  cursor: not-allowed;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 16px;
}

.admin-card {
  background: #232b36;
  color: #fff;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.admin-checkbox {
  margin-bottom: 8px;
}

.admin-card-content {
  width: 100%;
}

.admin-thumbnail {
  width: 100%;
  height: 150px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 8px;
}

.admin-thumbnail-placeholder {
  width: 100%;
  height: 150px;
  background: #555;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  margin-bottom: 8px;
  color: #ccc;
}

.admin-card h3 {
  margin: 0 0 8px 0;
  font-size: 1.2rem;
}

.admin-card p {
  margin: 0 0 8px 0;
  color: #ccc;
}

.admin-modal {
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

.admin-modal-content {
  background: #232b36;
  color: #fff;
  padding: 32px;
  border-radius: 8px;
  max-width: 600px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
}

.admin-modal-content h3 {
  margin-top: 0;
  margin-bottom: 24px;
}

.admin-modal-content .admin-input,
.admin-modal-content .admin-photo-preview {
  margin-bottom: 30px;
}

.admin-input[type="file"] {
  padding: 10px 16px;
  border-radius: 8px;
  border: 2px dashed #555;
  background: #232b36;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: border-color 0.2s;
}

.admin-input[type="file"]:hover {
  border-color: #4f8cff;
}

.admin-input[type="file"]::-webkit-file-upload-button {
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  margin-right: 10px;
}

.admin-input[type="file"]::-webkit-file-upload-button:hover {
  background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.admin-modal-buttons {
  display: flex;
  gap: 16px;
  justify-content: flex-end;
  margin-top: 34px;
}
</style>
