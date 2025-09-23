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
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.jp-modal {
  background: #fff;
  padding: 24px;
  border-radius: 8px;
  min-width: 300px;
  position: relative;
}
.jp-modal-close {
  position: absolute;
  top: 8px;
  right: 8px;
  background: #1976d2;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
}
</style>
