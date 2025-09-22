<template>
    <div v-if="visible" class="fullscreen-video" :style="fadeStyle">
        <video ref="videoRef" :src="videoUrl" controls autoplay></video>
        <button @click="onClose" class="close-btn main-btn">
            <span class="btn-icon">❌</span> 閉じる
        </button>

    </div>

</template>

<script setup lang="ts">
import { ref, watch, onUnmounted, computed, defineExpose } from 'vue';

const props = defineProps<{ src: string | Blob; visible: boolean; fadeOutDuration?: number; onClose: () => void }>();
const videoUrl = ref<string>('');
let objectUrl: string | null = null;

const fadeStyle = computed(() => {
    return props.fadeOutDuration ? { transition: `opacity ${props.fadeOutDuration}ms` } : {};
});

function updateVideoUrl() {
    if (props.src instanceof Blob) {
        console.log('[FullScreenVideo]Blob detected');
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
        objectUrl = URL.createObjectURL(props.src);
        videoUrl.value = objectUrl;
    } else {
        videoUrl.value = props.src;
    }
}

watch(() => props.src, updateVideoUrl, { immediate: true });

onUnmounted(() => {
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }
});

function stopAndClose(fadeOutDuration?: number) {
    if (fadeOutDuration && fadeOutDuration > 0) {
        const el = document.querySelector('.fullscreen-video') as HTMLElement | null;
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

defineExpose({ stopAndClose });
</script>

<style scoped>
.fullscreen-video {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
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
