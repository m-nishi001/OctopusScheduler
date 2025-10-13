<template>
    <div v-if="visible" class="fullscreen-html" :style="fadeStyle">
        <div class="html-content" v-html="htmlContent"></div>
        <button @click="onClose" class="close-btn main-btn">
            <span class="btn-icon">❌</span> 閉じる
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, defineExpose } from 'vue';

defineExpose({ hide });

const props = defineProps<{ htmlContent: string; visible: boolean; fadeOutDuration?: number; onClose: () => void }>();

const fadeStyle = computed(() => {
    return props.fadeOutDuration ? { transition: `opacity ${props.fadeOutDuration}ms` } : {};
});

function hide(fadeOutDuration?: number) {
    if (fadeOutDuration && fadeOutDuration > 0) {
        const el = document.querySelector('.fullscreen-html') as HTMLElement | null;
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
</script>

<style scoped>
.fullscreen-html {
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
    color: white;
}

.html-content {
    max-width: 90vw;
    max-height: 80vh;
    overflow: auto;
}

.close-btn {
    margin-top: 1rem;
}
</style>