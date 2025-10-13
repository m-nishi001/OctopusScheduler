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

const startSlideshow = async (data: SlideshowData) => {
    slideshowData.value = data;
    // TODO: Fetch images from Google Drive folder using folderId
    // For now, mock data
    images.value = [
        { id: "1", url: "/placeholder1.jpg", name: "Image 1" },
        { id: "2", url: "/placeholder2.jpg", name: "Image 2" },
    ];
    currentIndex.value = 0;
    intervalId.value = setInterval(() => {
        currentIndex.value = (currentIndex.value + 1) % images.value.length;
    }, data.displayDuration * 1000);
    // TODO: Play BGM
};

const stopSlideshow = () => {
    if (intervalId.value) {
        clearInterval(intervalId.value);
        intervalId.value = null;
    }
    images.value = [];
    // TODO: Stop BGM
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