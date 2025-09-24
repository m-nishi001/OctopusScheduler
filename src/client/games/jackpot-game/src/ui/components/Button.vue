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
  padding: 12px 28px;
  border-radius: 16px;
  background: linear-gradient(90deg, #fcd5ce 0%, #b8c0ff 100%);
  color: #6d6875;
  border: none;
  cursor: pointer;
  font-size: 1.1em;
  font-family: 'Montserrat', 'Arial', sans-serif;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(184,192,255,0.18), 0 1.5px 0 #fff inset;
  transition: transform 0.18s, box-shadow 0.18s, background 0.18s;
}
.jp-btn:hover {
  background: linear-gradient(90deg, #b8c0ff 0%, #fcd5ce 100%);
  box-shadow: 0 4px 16px rgba(252,213,206,0.22);
  transform: scale(1.07);
  color: #fff;
}
</style>
