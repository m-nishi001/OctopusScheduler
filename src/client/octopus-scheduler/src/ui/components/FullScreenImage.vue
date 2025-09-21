<template>
  <div v-if="visible" class="fullscreen-image" :style="fadeStyle">
    <img :src="src" alt="表示画像" />
    <button @click="onClose" class="close-btn main-btn">
      <span class="btn-icon">❌</span> 閉じる
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ src: string; visible: boolean; fadeOutDuration?: number; onClose: () => void }>();

const fadeStyle = computed(() => {
  return props.fadeOutDuration ? { transition: `opacity ${props.fadeOutDuration}ms` } : {};
});
</script>

<style scoped>
.fullscreen-image {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0,0,0,0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
img {
  max-width: 90vw;
  max-height: 80vh;
}
.close-btn {
  margin-top: 1rem;
}
</style>
