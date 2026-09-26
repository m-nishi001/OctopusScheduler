<template>
  <div class="modal-overlay">
    <div class="modal-content" @click.stop>
      <h3>{{ mode === 'edit' ? 'メンバー編集' : 'メンバーを追加' }}</h3>

      <div v-if="mode === 'add'" class="field-block">
        <label class="field-label">ID(任意)</label>
        <input v-model="id" type="text" placeholder="未入力の場合は自動採番されます" class="admin-input" />
      </div>

      <div class="field-block">
        <label class="field-label">名前</label>
        <input v-model="name" type="text" placeholder="メンバー名" class="admin-input member-name-input" />
      </div>

      <div class="modal-footer">
        <div class="footer-right admin-modal-buttons">
          <button class="admin-btn" @click="submit" :disabled="!name.trim() || saving">保存</button>
          <button class="admin-btn cancel-primary" @click="$emit('cancel')">キャンセル</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Member } from '@octopus/member-directory';
import type { MemberFormInput } from '../use-member-directory';

const props = defineProps<{
  mode: 'add' | 'edit';
  member: Member | null;
}>();

const emit = defineEmits<{
  submit: [input: MemberFormInput];
  cancel: [];
}>();

const id = ref('');
const name = ref('');
const saving = ref(false);

if (props.mode === 'edit' && props.member) {
  id.value = props.member.id;
  name.value = props.member.name;
}

const submit = async () => {
  if (!name.value.trim() || saving.value) return;
  saving.value = true;
  try {
    emit('submit', {
      id: props.mode === 'add' ? id.value.trim() || undefined : undefined,
      name: name.value.trim(),
    });
  } finally {
    saving.value = false;
  }
};
</script>

<style scoped>
.admin-input {
  padding: 10px 14px;
  border-radius: 8px;
  border: none;
  background: #232b36;
  color: #fff;
  font-size: 0.98rem;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  width: 100%;
  box-sizing: border-box;
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
  max-width: 480px;
  width: 90%;
}

.field-label {
  display: block;
  margin-bottom: 8px;
  color: #cfe8ff;
  font-weight: 600;
}

.field-block {
  margin-top: 12px;
}

.cancel-primary {
  background: #3b4650;
  color: #fff;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 18px;
}

.footer-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.admin-modal-buttons {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: flex-end;
  margin-top: 18px;
}
</style>
