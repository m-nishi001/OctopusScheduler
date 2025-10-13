<template>
    <div class="fullscreen-video">
        <video :src="videoUrl" controls autoplay></video>
        <button @click="onClose" class="close-btn main-btn">
            <span class="btn-icon">❌</span> 閉じる
        </button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, watch, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';

const route = useRoute();
const router = useRouter();
const assetService = container.resolve<AssetService>('AssetService');

const videoUrl = ref('');
let objectUrl: string | null = null;

const onClose = () => {
    router.back();
};

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

.close-btn {
    margin-top: 1rem;
}
</style>