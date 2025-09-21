<template>
  <div v-if="visible" class="fullscreen-video" :style="fadeStyle">
    <video ref="videoRef" :src="src" controls autoplay></video>
    <button @click="onClose" class="close-btn main-btn">
      <span class="btn-icon">❌</span> 閉じる
    </button>
  </div>
</template>

<script setup lang="ts">
import { watch, computed } from 'vue';
import { useVideo } from '../composables/use-video';

const props = defineProps<{ src: string; visible: boolean; fadeOutDuration?: number; onClose: () => void }>();
const { videoRef, play, stop } = useVideo();

const fadeStyle = computed(() => {
  return props.fadeOutDuration ? { transition: `opacity ${props.fadeOutDuration}ms` } : {};
});

watch(() => props.visible, (val) => {
  if (val) play(props.src);
  else stop(props.fadeOutDuration);
});
</script>

<style scoped>
.fullscreen-video {
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
video {
  max-width: 90vw;
  max-height: 80vh;
}
.close-btn {
  margin-top: 1rem;
}
</style>
