
<template>
  <div v-if="visible" class="fullscreen-image" :style="fadeStyle">
    <img :src="imageUrl" alt="表示画像" />
    <button @click="onClose" class="close-btn main-btn">
      <span class="btn-icon">❌</span> 閉じる
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed, defineExpose } from 'vue';
defineExpose({ hide });

const props = defineProps<{ src: string | Blob; visible: boolean; fadeOutDuration?: number; onClose: () => void }>();

const imageUrl = ref('');
let objectUrl: string | null = null;

const fadeStyle = computed(() => {
  return props.fadeOutDuration ? { transition: `opacity ${props.fadeOutDuration}ms` } : {};
});

function hide(fadeOutDuration?: number) {
  if (fadeOutDuration && fadeOutDuration > 0) {
    // フェードアウト後にダイアログを閉じる
    const el = document.querySelector('.fullscreen-image') as HTMLElement | null;
    if (el) {
      el.style.transition = `opacity ${fadeOutDuration}ms`;
      el.style.opacity = '0';
    }
    setTimeout(() => {
      if (el) {
        el.style.opacity = '1';
      }
      props.onClose();
    }, fadeOutDuration);
  } else {
    props.onClose();
  }
}

watch(() => props.src, (src) => {
  if (src instanceof Blob) {
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
    }
    objectUrl = URL.createObjectURL(src);
    imageUrl.value = objectUrl;
  } else {
    imageUrl.value = src;
  }
}, { immediate: true });

onUnmounted(() => {
  if (objectUrl) {
    URL.revokeObjectURL(objectUrl);
  }
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
