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
    </div>
    <div class="admin-grid">
      <div v-for="(member, idx) in members" :key="member.id" class="admin-card">
        <input type="checkbox" v-model="selectedMembers" :value="member.id" class="admin-checkbox" />
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
      <div class="photo-mode">
        <label><input type="radio" v-model="photoMode" value="upload" /> アップロード</label>
        <label><input type="radio" v-model="photoMode" value="select" /> 既存から選択</label>
      </div>
      <input v-if="photoMode === 'upload'" type="file" @change="onPhotoChange" accept="image/*" class="admin-input" />
      <select v-if="photoMode === 'select'" v-model="photoAssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
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
      <div class="photo-mode">
        <label><input type="radio" v-model="editPhotoMode" value="upload" /> アップロード</label>
        <label><input type="radio" v-model="editPhotoMode" value="select" /> 既存から選択</label>
      </div>
      <input v-if="editPhotoMode === 'upload'" type="file" @change="onEditPhotoChange" accept="image/*"
        class="admin-input" />
      <select v-if="editPhotoMode === 'select'" v-model="editPhotoAssetId" class="admin-input">
        <option value="">選択なし</option>
        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
      </select>
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
import { ref, onMounted, computed } from 'vue';
import { MemberService } from '../../../model/applications/member-service';
import { AssetService } from '../../../model/applications/asset-service';

import { container } from 'tsyringe';
const memberService = container.resolve(MemberService);
const assetService = container.resolve(AssetService);
const members = ref<any[]>([]);
const originalMembers = ref<any[]>([]);
const selectedMembers = ref<string[]>([]);
const sortBy = ref('name');
const showAddModal = ref(false);
const assets = ref<any[]>([]);
const photoMode = ref('upload');
const editPhotoMode = ref('upload');
const imageAssets = computed(() => assets.value.filter(asset => asset.type === 'image'));
const isMemberChanged = (member: any, original: any) => {
  return JSON.stringify(member) !== JSON.stringify(original);
};
const saveMembers = async () => {
  const toAdd = members.value.filter(m => !originalMembers.value.find((o: any) => o.id === m.id));
  const toUpdate = members.value.filter(m => {
    const original = originalMembers.value.find((o: any) => o.id === m.id);
    return original && isMemberChanged(m, original);
  });
  const toDelete = originalMembers.value.filter((o: any) => !members.value.find((m: any) => m.id === o.id)).map((o: any) => o.id);
  await memberService.batchOperations({
    add: toAdd,
    update: toUpdate,
    delete: toDelete
  });
  originalMembers.value = JSON.parse(JSON.stringify(members.value));
};
const fetchMembers = async () => {
  members.value = await memberService.fetchMembers();
  originalMembers.value = JSON.parse(JSON.stringify(members.value));
  sortMembers();
};
const fetchAssets = async () => {
  assets.value = await assetService.fetchAssets();
};
const sortMembers = () => {
  if (sortBy.value === 'name') {
    members.value.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy.value === 'order') {
    members.value.sort((a, b) => a.order - b.order);
  }
};
const memberName = ref('');
const photoAssetId = ref('');
const photoPreview = computed(() => photoAssetId.value);
const onPhotoChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      photoAssetId.value = ev.target?.result as string;
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
  showAddModal.value = false;
  sortMembers();
};
const editIdx = ref<number | null>(null);
const editName = ref('');
const editPhotoAssetId = ref('');
const editPhotoPreview = computed(() => editPhotoAssetId.value);
const onEditPhotoChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      editPhotoAssetId.value = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }
};
const editMember = (idx: number) => {
  editIdx.value = idx;
  const member = members.value[idx];
  editName.value = member.name;
  editPhotoAssetId.value = member.photoAssetId || '';
  editPhotoMode.value = member.photoAssetId && !member.photoAssetId.startsWith('data:') ? 'select' : 'upload';
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
  sortMembers();
};

onMounted(() => {
  fetchMembers();
  fetchAssets();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 28px;
}

.admin-controls {
  display: flex;
  gap: 12px;
  margin-bottom: 18px;
  align-items: center;
  flex-wrap: wrap;
}

.admin-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.98rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
}

.admin-input:focus {
  outline: 2px solid #4f8cff;
}

.admin-btn {
  padding: 9px 16px;
  border-radius: 10px;
  border: none;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  font-weight: 700;
  cursor: pointer;
  transition: box-shadow 0.18s, transform 0.12s;
}

.admin-btn:hover {
  box-shadow: 0 6px 18px rgba(79, 140, 255, 0.14);
}

.admin-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.admin-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 18px;
}

.admin-card {
  background: #232b36;
  color: #fff;
  border-radius: 10px;
  padding: 12px 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  gap: 12px;
  align-items: center;
}

.admin-checkbox {
  margin-left: 4px;
}

.admin-card-content {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
}

.admin-thumbnail {
  width: 96px;
  height: 96px;
  object-fit: cover;
  border-radius: 6px;
  flex: 0 0 96px;
}

.admin-thumbnail-placeholder {
  width: 96px;
  height: 96px;
  background: #2f3438;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  color: #bfcbdc;
  flex: 0 0 96px;
}

.admin-card h3 {
  margin: 0;
  font-size: 1.05rem;
}

.admin-card p {
  margin: 6px 0 0 0;
  color: #c9d7e6;
}

.admin-card-content button {
  margin-left: auto;
}

.admin-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.54);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.admin-modal-content {
  background: #232b36;
  color: #fff;
  padding: 28px;
  border-radius: 10px;
  max-width: 640px;
  width: 92%;
  max-height: 80vh;
  overflow-y: auto;
}

.admin-modal-content h3 {
  margin-top: 0;
  margin-bottom: 20px;
}

.admin-modal-content .admin-input,
.admin-modal-content .admin-photo-preview {
  margin-bottom: 20px;
}

.admin-input[type="file"] {
  padding: 10px 12px;
  border-radius: 8px;
  border: 2px dashed #434b51;
  background: #232b36;
  color: #fff;
  cursor: pointer;
}

.admin-input[type="file"]:hover {
  border-color: #4f8cff;
}

.admin-input[type="file"]::-webkit-file-upload-button {
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  color: #232b36;
  border: none;
  padding: 6px 10px;
  border-radius: 6px;
  margin-right: 8px;
}

.photo-mode,
.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
}

.admin-modal-buttons {
  justify-content: flex-end;
  margin-top: 18px;
}
</style>
