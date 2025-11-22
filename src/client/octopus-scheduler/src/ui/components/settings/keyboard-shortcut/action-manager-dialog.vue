<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal" @click.stop>
      <h4>{{ editingIndex === null ? 'アクションを追加' : 'アクションを編集' }}</h4>
      <div class="form-area">
        <component :is="formComponent" :initialData="editingData" @save="onSave" />
      </div>
      <div class="buttons">
        <button @click="confirmSave" class="save">保存して閉じる</button>
        <button @click="close" class="cancel">キャンセル</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import ACTION_REGISTRY, { getUIActionRegistry } from './action-registry';
import type { EventFormData } from './types';

const props = defineProps<{
  show: boolean;
  actionType: string | null;
  initialData: EventFormData | null;
  editingIndex: number | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', data: EventFormData, index: number | null): void;
}>();

const editingData = ref<EventFormData | null>(props.initialData || null);

const formComponent = computed(() => {
  const t = props.actionType || (editingData.value ? editingData.value.actionType : null);
  return t ? ACTION_REGISTRY[t]?.component : null;
});

function onSave(data: any) {
  // child form emits save with raw data; this wrapper will emit typed EventFormData
  editingData.value = { ...(data as EventFormData), actionType: (data.actionType || editingData.value?.actionType) } as EventFormData;
}

function confirmSave() {
  if (!editingData.value) return;
  emit('save', editingData.value, props.editingIndex ?? null);
  emit('close');
}

function close() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay { position: fixed; inset: 0; display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);} 
.modal { background:#222;color:#fff;padding:16px;border-radius:8px;width:520px; }
.form-area { margin:10px 0; }
.buttons { display:flex;gap:8px;justify-content:flex-end; }
</style>
