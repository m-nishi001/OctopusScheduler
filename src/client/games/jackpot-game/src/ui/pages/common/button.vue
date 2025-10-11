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
  padding: 9px 18px;
  border-radius: 10px;
  background: linear-gradient(90deg, #f3e8ff 0%, #d9f2ff 100%);
  color: #6d6875;
  border: none;
  cursor: pointer;
  font-size: 1.0em;
  font-family: 'Montserrat', 'Arial', sans-serif;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(184, 192, 255, 0.12), 0 1px 0 #fff inset;
  transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
}

.jp-btn:hover {
  background: linear-gradient(90deg, #d9f2ff 0%, #f3e8ff 100%);
  box-shadow: 0 6px 18px rgba(150, 160, 255, 0.12);
  transform: scale(1.03);
  color: #fff;
}
</style>
