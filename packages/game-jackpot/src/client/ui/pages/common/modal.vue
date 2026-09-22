<template>
  <div v-if="visible" class="jp-modal-overlay" @click.self="$emit('close')">
    <div class="jp-modal">
      <slot />
      <button class="jp-modal-close" @click="$emit('close')">閉じる</button>
    </div>
  </div>
</template>

<script lang="ts">
export default {
  name: 'Modal',
  props: {
    visible: { type: Boolean, required: true },
  },
};
</script>

<style scoped>
.jp-modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(252,213,206,0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  animation: fadeIn 0.3s;
}
.jp-modal {
  background: linear-gradient(135deg, #fff 60%, #b8c0ff 100%);
  padding: 28px 22px;
  border-radius: 18px;
  min-width: 280px;
  position: relative;
  box-shadow: 0 4px 16px rgba(184,192,255,0.18);
  animation: popIn 0.3s;
}
.jp-modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(90deg, #fcd5ce 0%, #b8c0ff 100%);
  color: #6d6875;
  border: none;
  border-radius: 8px;
  padding: 5px 12px;
  cursor: pointer;
  font-family: 'Montserrat', 'Arial', sans-serif;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(184,192,255,0.12);
  transition: background 0.18s, box-shadow 0.18s;
}
.jp-modal-close:hover {
  background: linear-gradient(90deg, #b8c0ff 0%, #fcd5ce 100%);
  box-shadow: 0 4px 16px rgba(252,213,206,0.22);
  color: #fff;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes popIn {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}
</style>
