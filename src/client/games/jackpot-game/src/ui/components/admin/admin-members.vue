<template>
  <button class="admin-btn mt-4" @click="saveMembers">保存</button>
  <div class="admin-section">
    <h2>メンバー管理</h2>
    <form class="admin-form" @submit.prevent="addMember">
      <input v-model="memberName" type="text" placeholder="名前" class="admin-input" />
      <input type="file" @change="onPhotoChange" accept="image/*" class="admin-input" />
      <div v-if="photoPreview" class="admin-photo-preview">
        <img :src="photoPreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <input v-model="attributeInput" type="text" placeholder="属性（カンマ区切り可）" class="admin-input" />
      <button type="submit" class="admin-btn">追加</button>
    </form>
    <ul class="admin-list">
      <li v-for="(member, idx) in members" :key="member.id" class="admin-list-item">
        <span>{{ member.name }}</span>
        <span v-if="member.photoAssetId">
          <img :src="member.photoAssetId" alt="photo" style="max-width:40px;max-height:40px;vertical-align:middle;" />
        </span>
        <span v-if="member.attributes && member.attributes.length">
          属性: {{ member.attributes.join(', ') }}
        </span>
        <button class="admin-btn ml-2" @click="editMember(idx)">編集</button>
        <button class="admin-btn ml-2" @click="deleteMember(idx)">削除</button>
      </li>
    </ul>
    <div v-if="editIdx !== null" class="admin-edit-box">
      <h3>メンバー編集</h3>
      <input v-model="editName" type="text" class="admin-input" />
      <input type="file" @change="onEditPhotoChange" accept="image/*" class="admin-input" />
      <div v-if="editPhotoPreview" class="admin-photo-preview">
        <img :src="editPhotoPreview" alt="preview" style="max-width:80px;max-height:80px;" />
      </div>
      <input v-model="editAttributeInput" type="text" placeholder="属性（カンマ区切り可）" class="admin-input" />
      <button class="admin-btn" @click="saveEdit">保存</button>
      <button class="admin-btn ml-2" @click="cancelEdit">キャンセル</button>
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
const isMemberChanged = (member: any, original: any) => {
  return JSON.stringify(member) !== JSON.stringify(original);
};
const saveMembers = async () => {
  for (let i = 0; i < members.value.length; i++) {
    const member = members.value[i];
    const original = originalMembers.value[i];
    if (!original || isMemberChanged(member, original)) {
      // 画像未変更ならアップロードしない仮実装
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
};
const memberName = ref('');
const photoAssetId = ref('');
const photoPreview = ref('');
const attributeInput = ref('');
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
    attributes: attributeInput.value ? attributeInput.value.split(',').map(a => a.trim()) : [],
    order: members.value.length + 1
  });
  memberName.value = '';
  photoAssetId.value = '';
  photoPreview.value = '';
  attributeInput.value = '';
};
const editIdx = ref<number | null>(null);
const editName = ref('');
const editPhotoAssetId = ref('');
const editPhotoPreview = ref('');
const editAttributeInput = ref('');
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
  editName.value = members.value[idx].name;
  editPhotoAssetId.value = members.value[idx].photoAssetId || '';
  editPhotoPreview.value = members.value[idx].photoAssetId || '';
  editAttributeInput.value = members.value[idx].attributes ? members.value[idx].attributes.join(', ') : '';
};
const saveEdit = () => {
  if (editIdx.value === null) return;
  members.value[editIdx.value].name = editName.value;
  members.value[editIdx.value].photoAssetId = editPhotoAssetId.value;
  members.value[editIdx.value].attributes = editAttributeInput.value ? editAttributeInput.value.split(',').map(a => a.trim()) : [];
  editIdx.value = null;
  editName.value = '';
  editPhotoAssetId.value = '';
  editPhotoPreview.value = '';
  editAttributeInput.value = '';
};
const cancelEdit = () => {
  editIdx.value = null;
  editName.value = '';
  editPhotoAssetId.value = '';
  editPhotoPreview.value = '';
  editAttributeInput.value = '';
};
const deleteMember = (idx: number) => {
  // TODO: API経由で削除する実装に変更
  members.value.splice(idx, 1);
};

onMounted(() => {
  fetchMembers();
});
</script>

<style scoped>
.admin-section {
  margin-bottom: 32px;
}

.admin-form {
  display: flex;
  gap: 16px;
  margin-bottom: 24px;
  flex-wrap: wrap;
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

.admin-list {
  list-style: none;
  padding: 0;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.admin-list-item {
  background: #232b36;
  color: #fff;
  padding: 10px 16px;
  border-radius: 8px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
</style>
