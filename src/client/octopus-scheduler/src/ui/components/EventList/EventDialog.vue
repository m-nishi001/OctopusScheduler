<template>
  <div class="dialog-backdrop">
    <div class="dialog">
      <h3 v-if="mode==='add'">イベント追加</h3>
      <h3 v-else-if="mode==='edit'">イベント編集</h3>
      <h3 v-else>イベント詳細</h3>

      <div>
        <label>名前: <input v-model="local.name" :disabled="mode==='detail'" /></label>
      </div>

      <div>
        <label>種別:
          <select v-model="local.type" :disabled="mode==='detail'">
            <option value="AudioEvent">AudioEvent</option>
            <option value="ImageEvent">ImageEvent</option>
            <option value="VideoEvent">VideoEvent</option>
            <option value="TransitionEvent">TransitionEvent</option>
          </select>
        </label>
      </div>

      <div v-if="local.type !== 'TransitionEvent'">
        <label>アセット: <input v-model="local.assetName" :disabled="mode==='detail'" /></label>
      </div>

      <div style="margin-top:1em;">
        <button v-if="mode!=='detail'" @click="onSave">保存</button>
        <button @click="$emit('close')">閉じる</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive } from 'vue';

const props = defineProps<{
  mode: 'add'|'edit'|'detail';
  event?: { id?: string; name?: string; type?: string; assetName?: string } | null;
}>();
const emit = defineEmits<{
  (e: 'save', payload: any): void;
  (e: 'close'): void;
}>();

const local = reactive({ id: props.event?.id ?? '', name: props.event?.name ?? '', type: props.event?.type ?? 'AudioEvent', assetName: props.event?.assetName ?? '' });

function onSave() {
  emit('save', { id: local.id || crypto.randomUUID(), name: local.name, type: local.type, assetName: local.assetName });
}
</script>

<style scoped>
.dialog-backdrop{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.4);z-index:1000}
.dialog{background:white;padding:1.2rem;border-radius:8px;min-width:320px}
</style>
