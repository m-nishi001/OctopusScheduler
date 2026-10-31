<template>
    <div class="fullscreen-image">
        <img v-if="imageUrl" :src="imageUrl" alt="表示画像" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetSource } from '../../../../control/media/asset-source';

/** 画像を出したままにする。消すのは、スクリーンを消す操作(別の画面へ戻す)だけ。 */
const route = useRoute();
const source = container.resolve(AssetSource);

const imageUrl = ref('');

function release() {
    if (imageUrl.value) URL.revokeObjectURL(imageUrl.value);
    imageUrl.value = '';
}

async function load() {
    release();
    const id = route.params.id as string;
    if (!id) return;
    try {
        imageUrl.value = URL.createObjectURL(await source.ensure(id));
    } catch (e) {
        console.error('Failed to load image asset', e);
    }
}

onMounted(() => {
    void load();
    watch(() => route.fullPath, () => void load());
});
onUnmounted(release);
</script>

<style scoped>
.fullscreen-image {
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

img {
    max-width: 90vw;
    max-height: 80vh;
    animation: fadeIn 1.2s;
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
</style>
