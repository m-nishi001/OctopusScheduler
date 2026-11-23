<template>
    <div class="fullscreen-video">
        <video v-if="videoUrl" ref="videoEl" :src="videoUrl" controls autoplay></video>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetSource } from '../../../../control/media/asset-source';
import { VideoOutput } from '../../../../control/media/video-output';

/** 動画を出したままにする。消すのは、スクリーンを消す操作(別の画面へ戻す)だけ。 */
const route = useRoute();
const source = container.resolve(AssetSource);

const output = container.resolve(VideoOutput);

const videoUrl = ref('');
const videoEl = ref<HTMLVideoElement | null>(null);

// 動画の要素を、スクリーンの窓口(`VideoOutput`)に渡す。消す・切り替えるときの音のフェードは、窓口が行う
watch(videoEl, (el) => (el ? output.attach(el) : output.detach()));

function release() {
    if (videoUrl.value) URL.revokeObjectURL(videoUrl.value);
    videoUrl.value = '';
}

async function load() {
    release();
    const id = route.params.id as string;
    if (!id) return;
    try {
        videoUrl.value = URL.createObjectURL(await source.ensure(id));
    } catch (e) {
        console.error('Failed to load video asset', e);
    }
}

onMounted(() => {
    void load();
    watch(() => route.fullPath, () => void load());
});
onUnmounted(() => {
    output.detach();
    release();
});
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
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

video {
    max-width: 90vw;
    max-height: 80vh;
    animation: fadeIn 1.2s;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
</style>
