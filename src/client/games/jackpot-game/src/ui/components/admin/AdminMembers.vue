<template>
  <div class="admin-section">
    <h2>メンバー管理</h2>
    <form class="admin-form" @submit.prevent="addMember">
      <input v-model="memberName" type="text" placeholder="名前" class="admin-input" />
      <button type="submit" class="admin-btn">追加</button>
    </form>
    <ul class="admin-list">
      <li v-for="(member, idx) in members" :key="member.id" class="admin-list-item">
        <span>{{ member.name }}</span>
        <button class="admin-btn ml-2" @click="editMember(idx)">編集</button>
        <button class="admin-btn ml-2" @click="deleteMember(idx)">削除</button>
      </li>
    </ul>
    <div v-if="editIdx !== null" class="admin-edit-box">
      <h3>メンバー編集</h3>
      <input v-model="editName" type="text" class="admin-input" />
      <button class="admin-btn" @click="saveEdit">保存</button>
      <button class="admin-btn ml-2" @click="cancelEdit">キャンセル</button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { MemberService } from '../../../model/applications/MemberService';

const memberService = new MemberService();
const members = ref<any[]>([]);
const fetchMembers = async () => {
  members.value = await memberService.fetchMembers();
};
const memberName = ref('');
const addMember = () => {
  // TODO: API経由で追加する実装に変更
  if (!memberName.value) return;
  members.value.push({
    id: String(Date.now()),
    name: memberName.value,
    order: members.value.length + 1
  });
  memberName.value = '';
};
const editIdx = ref<number|null>(null);
const editName = ref('');
const editMember = (idx: number) => {
  editIdx.value = idx;
  editName.value = members.value[idx].name;
};
const saveEdit = () => {
  // TODO: API経由で編集する実装に変更
  if (editIdx.value === null) return;
  members.value[editIdx.value].name = editName.value;
  editIdx.value = null;
  editName.value = '';
};
const cancelEdit = () => {
  editIdx.value = null;
  editName.value = '';
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
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
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
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
</style>
