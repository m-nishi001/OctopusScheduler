<template>
  <div v-if="show" class="modal-overlay" @click.self="onCancel">
    <div class="modal" @click.stop>
      <h4>アクションを選択</h4>
      <div class="form-area">
        <p>追加するアクションの種類を選択してください:</p>
        <ul class="action-type-list">
          <li v-for="(entry, key) in registry" :key="key">
            <button @click="selectType(key)">{{ entry.label }}</button>
          </li>
        </ul>
      </div>
      <div class="buttons">
        <button @click="onCancel" class="cancel">閉じる</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { container } from 'tsyringe';
import { UIActionEntryToken } from '../../../../core/container';

defineProps<{ show: boolean }>();

const emit = defineEmits<{
  (e: 'select-type', payload: { type: string }): void;
  (e: 'cancel'): void;
}>();

// resolve registry entries from DI
const registry: Record<string, any> = (() => {
  try {
    const entries = container.resolveAll<any>(UIActionEntryToken as any) as any[];
    const m: Record<string, any> = {};
    for (const e of entries) if (e && e.actionType) m[e.actionType] = e;
    return m;
  } catch (err) {
    return {};
  }
})();

function selectType(type: string) {
  emit('select-type', { type });
}

function onCancel() {
  emit('cancel');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.5);
}

.modal {
  background: #222;
  color: #fff;
  padding: 16px;
  border-radius: 8px;
  width: 520px;
}

.form-area {
  margin: 10px 0;
}

.buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}
</style>
