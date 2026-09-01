<template>
    <div class="slideshow-container">
        <div v-for="(image, index) in images" :key="image.id" class="slide" :class="{ active: index === currentIndex }"
            :style="getSlideStyle(index)">
            <img :src="image.url" :alt="image.name" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from "vue";
import { useRoute } from 'vue-router';
import { eventBus } from "../../../../core/event-bus";
import { container } from "tsyringe";
import type { IAssetRepository } from "../../../../model/domains/assets/repository/asset-repository";
import { IAssetRepositoryToken } from "../../../../model/domains/assets/repository/asset-repository";

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
const assetRepository = container.resolve<IAssetRepository>(IAssetRepositoryToken);

const route = useRoute();

const startSlideshow = async (data: SlideshowData) => {
    slideshowData.value = data;
    // 1) fetch metadata only
    const metaService = new (await import("@common-lib/google-apps-script/gas-script-service")).GasFunctionService("octopusScheduler_getDriveMetaData");
    let metas: any[] = [];
    try {
        metas = (await metaService.call(data.folderId)) || [];
    } catch (err) {
        console.error('Failed to fetch drive metadata', err);
    }

    // filter image metas and initialize images list with empty urls
    const imageMetas = metas.filter((m: any) => (m?.fileName || '').match(/\.(jpg|jpeg|png|gif|webp)$/i));
    images.value = imageMetas.map((m: any) => ({ id: m.fileId || m.driveDataId || String(Math.random()), url: "", name: m.fileName || "" }));
    currentIndex.value = 0;

    if (images.value.length === 0) return;

    // 2) fetch first image immediately (parallel if multiple firsts desired)
    const first = images.value[0];
    try {
        const getService = new (await import("@common-lib/google-apps-script/gas-script-service")).GasFunctionService("octopusScheduler_getDriveData");
        const res = await getService.call(first.id);
        if (res && res.fileDataUrl) {
            const blob = await (await fetch(res.fileDataUrl)).blob();
            first.url = URL.createObjectURL(blob);
        }
    } catch (e) {
        console.error('failed to fetch first slideshow image', e);
    }

    // 3) start interval after first image available
    intervalId.value = setInterval(async () => {
        if (images.value.length === 0) return;
        currentIndex.value = (currentIndex.value + 1) % images.value.length;
        await loadCurrentImage();
    }, data.displayDuration * 1000);

    // 4) bulk-prefetch remaining images without concurrency cap
    (async () => {
        try {
            const getService = new (await import("@common-lib/google-apps-script/gas-script-service")).GasFunctionService("octopusScheduler_getDriveData");
            const fetchPromises = images.value.map(async (img) => {
                if (img.url) return; // already loaded
                try {
                    const res = await getService.call(img.id);
                    if (!res) return;
                    const blob = await (await fetch(res.fileDataUrl)).blob();
                    img.url = URL.createObjectURL(blob);
                } catch (e) {
                    console.error('prefetch failed for', img.id, e);
                }
            });
            await Promise.all(fetchPromises);
        } catch (e) {
            console.error('bulk prefetch failed', e);
        }
    })();
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
    if (asset && (asset as any).blob) {
        try {
            currentImage.url = URL.createObjectURL((asset as any).blob);
        } catch (err) {
            console.error('Failed to create object URL for slideshow image', err);
        }
    }
    // Preload next image
    const nextIndex = (currentIndex.value + 1) % images.value.length;
    const nextImage = images.value[nextIndex];
    if (nextImage && !nextImage.url) {
        const nextAsset = await assetRepository.getAssetById(nextImage.id);
        if (nextAsset && (nextAsset as any).blob) {
            try {
                nextImage.url = URL.createObjectURL((nextAsset as any).blob);
            } catch (err) {
                console.error('Failed to create object URL for next slideshow image', err);
            }
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
    // Watch route changes to support re-triggering slideshow when same route is pushed
    watch(() => route.fullPath, () => {
        // Reset slideshow state
        stopSlideshow();
        try {
            const raw = route.params.data as any;
            if (raw) {
                const parsed = JSON.parse(String(raw));
                if (parsed && parsed.folderId) {
                    void startSlideshow(parsed as SlideshowData);
                }
            }
        } catch (e) {
            // ignore parse errors
        }
    });
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