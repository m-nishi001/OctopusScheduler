<template>
    <div class="fullscreen-video">
        <video ref="videoEl" :src="videoUrl" controls autoplay :class="displayModeClass"></video>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';
import gsap from 'gsap';

const route = useRoute();
const assetService = container.resolve(AssetService);

const videoUrl = ref('');
let objectUrl: string | null = null;
const videoEl = ref<HTMLVideoElement | null>(null);

const effect = ref(route.query.effect as string || 'fade');
const manual = ref((route.query.manual as string) === 'true');
const fadeInTime = ref(parseFloat(route.query.fadeInTime as string) || 1);

const displayModeClass = computed(() => {
    return effect.value === 'fade' ? 'fade-in' : '';
});

function updateVideoUrl() {
    // Blob handling if needed
}

watch(() => videoUrl.value, updateVideoUrl, { immediate: true });

onMounted(async () => {
    const id = route.params.id as string;
    if (id) {
        const asset = await assetService.getAssetById(id);
        if (asset) {
            if ((asset as any).blob) {
                try {
                    objectUrl = URL.createObjectURL((asset as any).blob);
                    videoUrl.value = objectUrl;
                } catch (err) {
                    console.error('Failed to create object URL for video', err);
                }
            }
        }
    }
    await nextTick();
    startAnimation();
});

function startAnimation() {
    if (!videoEl.value) return;
    const el = videoEl.value;
    gsap.set(el, { opacity: 0 });

    if (effect.value === 'fade') {
        gsap.to(el, { opacity: 1, duration: fadeInTime.value });
    } else {
        gsap.set(el, { opacity: 1 });
    }
}

onUnmounted(() => {
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }
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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
}

video {
    max-width: 90vw;
    max-height: 80vh;
}

.fade-in {
    animation: fadeIn 1.2s;
}

.scroll-up {
    animation: scrollUp 3s linear forwards;
}

.scroll-down {
    animation: scrollDown 3s linear forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes scrollUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes scrollDown {
    from {
        transform: translateY(-100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}
</style>