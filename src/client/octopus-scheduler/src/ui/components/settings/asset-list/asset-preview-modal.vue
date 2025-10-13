<template>
  <div class="modal-overlay" @click.self="onClose">
    <div class="modal-content">
      <slot />
      <button class="close-btn" @click="onClose">閉じる</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineEmits } from 'vue';
const emit = defineEmits(['close']);
function onClose() {
  emit('close');
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.modal-content {
  background: #222;
  border-radius: 12px;
  padding: 2em;
  box-shadow: 0 4px 32px #000a;
  min-width: 320px;
  max-width: 90vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.close-btn {
  margin-top: 1em;
  padding: 0.5em 1.5em;
  background: #444;
  color: #fff;
  border: none;
  border-radius: 8px;
  cursor: pointer;
}
.close-btn:hover {
  background: #666;
}
</style>
