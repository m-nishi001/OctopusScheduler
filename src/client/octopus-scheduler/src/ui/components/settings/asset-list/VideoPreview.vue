<template>
    <div class="video-preview">
        <video
            :src="videoUrl"
            controls
            class="video-player"
        />
        <div v-if="name" class="video-name">
            {{ name }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{ src: string | Blob; name?: string }>();
const videoUrl = ref<string>('');

let objectUrl: string | null = null;

function updateVideoUrl() {
    if (props.src instanceof Blob) {
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
</script>

<style scoped>
/* 動画プレビュー用のスタイルはtemplate内で直接指定 */
</style>
