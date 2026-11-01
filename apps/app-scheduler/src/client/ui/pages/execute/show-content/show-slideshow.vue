<template>
    <div class="slideshow-container">
        <Transition :name="transition">
            <img v-if="current" :key="current.key" :src="current.url" alt="スライド" class="slide" />
        </Transition>
    </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetRepository } from '../../../../model/asset/asset-repository';
import { parseScreenSpec } from '../../../../model/media/screen-spec';
import { AssetSource } from '../../../../control/media/asset-source';
import { folderImageLister, runSlideshow } from '../../../../control/media/slideshow';

/** スライドショー。画像の取得と進行は `runSlideshow` が行い、ここは映すだけ。 */
const route = useRoute();
const source = container.resolve(AssetSource);
const repository = container.resolve(AssetRepository);

const transition = ref<'fade' | 'slide'>('fade');
const current = ref<{ key: number; url: string } | null>(null);
let stop: (() => void) | null = null;
let shown = 0;

function release() {
    stop?.();
    stop = null;
    if (current.value) URL.revokeObjectURL(current.value.url);
    current.value = null;
}

function start() {
    release();
    let spec = null;
    try {
        spec = parseScreenSpec(JSON.parse(String(route.params.data)));
    } catch {
        // 指定が読めないときは、何も映さない
    }
    if (!spec || spec.kind !== 'slideshow') return;
    transition.value = spec.transition;
    stop = runSlideshow(
        spec,
        {
            listImageIds: folderImageLister(repository, (id, fileId) => source.ensure(id, fileId)),
            ensure: (id) => source.ensure(id),
            sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
        },
        (image) => {
            const previous = current.value;
            current.value = { key: ++shown, url: URL.createObjectURL(image) };
            // 前の画像は、切り替えの動きが終わってから解放する
            if (previous) setTimeout(() => URL.revokeObjectURL(previous.url), 2000);
        }
    );
}

onMounted(() => {
    start();
    watch(() => route.fullPath, start);
});
onUnmounted(release);
</script>

<style scoped>
.slideshow-container {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
    background: #000;
}

.slide {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 1s;
}

.fade-enter-from,
.fade-leave-to {
    opacity: 0;
}

.slide-enter-active,
.slide-leave-active {
    transition: transform 1s;
}

.slide-enter-from {
    transform: translateX(100%);
}

.slide-leave-to {
    transform: translateX(-100%);
}
</style>
