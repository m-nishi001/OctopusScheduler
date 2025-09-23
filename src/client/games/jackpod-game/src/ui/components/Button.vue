<template>
  <button :type="type" :class="['jp-btn', customClass]" @click="$emit('click')">
    <slot />
  </button>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
export default defineComponent({
  name: 'Button',
  props: {
    type: {
      type: String as () => 'button' | 'submit' | 'reset',
      default: 'button',
    },
    customClass: { type: String, default: '' },
  },
});
</script>

<style scoped>
.jp-btn {
  padding: 8px 16px;
  border-radius: 4px;
  background: #1976d2;
  color: #fff;
  border: none;
  cursor: pointer;
}
</style>
