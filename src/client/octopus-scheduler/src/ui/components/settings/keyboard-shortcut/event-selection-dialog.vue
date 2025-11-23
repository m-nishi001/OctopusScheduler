<template>
  <div v-if="show" class="modal-overlay" @click.self="close">
    <div class="modal" @click.stop>
      <h4>{{ editingIndex === null ? 'アクションを追加' : 'アクションを編集' }}</h4>
      <div class="form-area">
        <div v-if="!selectedType">
          <p>追加するアクションの種類を選択してください:</p>
          <ul class="action-type-list">
            <li v-for="(entry, key) in registry" :key="key">
              <button @click="selectType(key)">{{ entry.label }}</button>
            </li>
          </ul>
        </div>
        <div v-else>
          <component :is="formComponent" :initialData="editingData" @save="onSave" />
        </div>
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
const selectedType = ref<string | null>(props.actionType || (editingData.value ? editingData.value.actionType : null));

const registry = ACTION_REGISTRY;

const formComponent = computed(() => {
  const t = selectedType.value || props.actionType || (editingData.value ? editingData.value.actionType : null);
  return t ? ACTION_REGISTRY[t]?.component : null;
});

function selectType(type: string) {
  selectedType.value = type;
  // initialize editingData for the selected type with sensible defaults
  switch (type) {
    case 'TransitionPageEvent':
      editingData.value = { actionType: 'TransitionPageEvent', transitionUrl: '' } as any;
      break;
    case 'PlayAudioEvent':
      editingData.value = { actionType: 'PlayAudioEvent', audioId: '' } as any;
      break;
    case 'SlideshowEvent':
      editingData.value = { actionType: 'SlideshowEvent', folderId: '', displayDuration: 5 } as any;
      break;
    case 'ShowContentEvent':
      editingData.value = { actionType: 'ShowContentEvent', contentType: 'image', contentId: '' } as any;
      break;
    default:
      editingData.value = { actionType: type } as any;
  }
}

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
