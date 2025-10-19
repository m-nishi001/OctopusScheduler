<template>
    <div class="slideshow-container">
        <div v-for="(image, index) in images" :key="image.id" class="slide" :class="{ active: index === currentIndex }"
            :style="getSlideStyle(index)">
            <img :src="image.url" :alt="image.name" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { eventBus } from "../../../../core/event-bus";
import { container } from "tsyringe";
import type { IAssetRepository } from "../../../../model/domains/assets/repository/asset-repository";

interface SlideshowData {
    folderId: string;
    displayDuration: number;
    transitionType: "fade" | "slide";
    slideDirection?: "left" | "right" | "up" | "down";
    bgmIds: string[];
}

const images = ref<{ id: string; url: string; name: string }[]>([]);
const currentIndex = ref(0);
const intervalId = ref<number | null>(null);
const slideshowData = ref<SlideshowData | null>(null);
const assetRepository = container.resolve<IAssetRepository>("IAssetRepository");

const startSlideshow = async (data: SlideshowData) => {
    slideshowData.value = data;
    const allMetadata = await assetRepository.getAssets();
    const assetMetadata = allMetadata.filter(
        (meta: any) => meta.metadata?.parentFolderId === data.folderId && meta.fileKind?.startsWith("image")
    );
    images.value = assetMetadata.map((meta: any) => ({ id: meta.metadata.driveDataId, url: "", name: meta.fileName }));
    currentIndex.value = 0;
    await loadCurrentImage();
    intervalId.value = setInterval(async () => {
        currentIndex.value = (currentIndex.value + 1) % images.value.length;
        await loadCurrentImage();
    }, data.displayDuration * 1000);
    // TODO: Play BGM
};

const stopSlideshow = () => {
    if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
    }
    images.value.forEach(img => {
        if (img.url) {
            URL.revokeObjectURL(img.url);
        }
    });
    images.value = [];
    // TODO: Stop BGM
};

const loadCurrentImage = async () => {
    const currentImage = images.value[currentIndex.value];
    if (!currentImage || currentImage.url) return;
    const asset = await assetRepository.getAssetById(currentImage.id);
    if (asset && (asset as any).fileDataUrl) {
        currentImage.url = (asset as any).fileDataUrl;
    }
    // Preload next image
    const nextIndex = (currentIndex.value + 1) % images.value.length;
    const nextImage = images.value[nextIndex];
    if (nextImage && !nextImage.url) {
        const nextAsset = await assetRepository.getAssetById(nextImage.id);
        if (nextAsset && (nextAsset as any).fileDataUrl) {
            nextImage.url = (nextAsset as any).fileDataUrl;
        }
    }
    // Unload previous image to save memory
    const prevIndex = currentIndex.value === 0 ? images.value.length - 1 : currentIndex.value - 1;
    const prevImage = images.value[prevIndex];
    if (prevImage && prevImage.url) {
        URL.revokeObjectURL(prevImage.url);
        prevImage.url = "";
    }
};

const getSlideStyle = (index: number) => {
    if (!slideshowData.value) return {};
    const isActive = index === currentIndex.value;
    if (slideshowData.value.transitionType === "fade") {
        return {
            opacity: isActive ? 1 : 0,
            transition: "opacity 1s",
        };
    } else {
        // slide
        const direction = slideshowData.value.slideDirection || "left";
        let transform = "";
        if (direction === "left") {
            transform = isActive ? "translateX(0)" : "translateX(-100%)";
        } else if (direction === "right") {
            transform = isActive ? "translateX(0)" : "translateX(100%)";
        } else if (direction === "up") {
            transform = isActive ? "translateY(0)" : "translateY(-100%)";
        } else if (direction === "down") {
            transform = isActive ? "translateY(0)" : "translateY(100%)";
        }
        return {
            transform,
            transition: "transform 1s",
        };
    }
};

onMounted(() => {
    eventBus.on("startSlideshow", startSlideshow);
    eventBus.on("stopSlideshow", stopSlideshow);
});

onUnmounted(() => {
    eventBus.off("startSlideshow", startSlideshow);
    eventBus.off("stopSlideshow", stopSlideshow);
    stopSlideshow();
});
</script>

<style scoped>
.slideshow-container {
    position: relative;
    width: 100%;
    height: 100vh;
    overflow: hidden;
}

.slide {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
}

.slide img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}
</style>