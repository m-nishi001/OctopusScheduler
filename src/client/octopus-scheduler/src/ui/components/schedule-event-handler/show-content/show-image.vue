<template>
    <div class="fullscreen-image">
        <img :src="imageUrl" alt="表示画像" />
        <button @click="onClose" class="close-btn main-btn">
            <span class="btn-icon">❌</span> 閉じる
        </button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';

const route = useRoute();
const router = useRouter();
const assetService = container.resolve<AssetService>('AssetService');

const imageUrl = ref('');
let objectUrl: string | null = null;

const onClose = () => {
    router.back();
};

onMounted(async () => {
    const id = route.params.id as string;
    if (id) {
        const asset = await assetService.getAssetById(id);
        if (asset && asset.dataUrl) {
            imageUrl.value = asset.dataUrl;
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
.fullscreen-image {
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

img {
    max-width: 90vw;
    max-height: 80vh;
}

.close-btn {
    margin-top: 1rem;
}
</style>