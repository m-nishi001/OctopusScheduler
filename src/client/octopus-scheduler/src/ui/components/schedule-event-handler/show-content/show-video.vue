<template>
    <div class="fullscreen-video">
        <video :src="videoUrl" controls autoplay :class="displayModeClass"></video>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';

const route = useRoute();
const assetService = container.resolve<AssetService>('AssetService');

const videoUrl = ref('');
let objectUrl: string | null = null;

const displayMode = ref(route.query.displayMode as string || 'fade');

const displayModeClass = computed(() => {
    return displayMode.value === 'fade' ? 'fade-in' : displayMode.value;
});

function updateVideoUrl() {
    // Blob handling if needed
}

watch(() => videoUrl.value, updateVideoUrl, { immediate: true });

onMounted(async () => {
    const id = route.params.id as string;
    if (id) {
        const asset = await assetService.getAssetById(id);
        if (asset && asset.dataUrl) {
            videoUrl.value = asset.dataUrl;
        }
    }
});

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