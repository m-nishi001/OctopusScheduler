<template>
    <div class="fullscreen-image">
        <img ref="imgEl" :src="imageUrl" alt="表示画像" :class="displayModeClass" />
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, onUnmounted, computed, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';
import gsap from 'gsap';

const route = useRoute();
const assetService = container.resolve<AssetService>('AssetService');

const imageUrl = ref('');
let objectUrl: string | null = null;
const imgEl = ref<HTMLImageElement | null>(null);

const effect = ref(route.query.effect as string || 'fade');
const duration = ref(parseFloat(route.query.duration as string) || 3);
const fadeInTime = ref(parseFloat(route.query.fadeInTime as string) || 1);
const fadeOutTime = ref(parseFloat(route.query.fadeOutTime as string) || 1);
const scrollDirection = ref(route.query.scrollDirection as string || 'up');

const displayModeClass = computed(() => {
    if (effect.value === 'fade') {
        return 'fade-in';
    } else if (effect.value === 'scroll') {
        return `scroll-${scrollDirection.value}`;
    } else {
        return '';
    }
});

onMounted(async () => {
    const id = route.params.id as string;
    if (id) {
        const asset = await assetService.getAssetById(id);
        if (asset) {
            if ((asset as any).blob) {
                try {
                    objectUrl = URL.createObjectURL((asset as any).blob);
                    imageUrl.value = objectUrl;
                } catch (err) {
                    console.error('Failed to create object URL for image', err);
                }
            }
        }
    }
    await nextTick();
    startAnimation();
});

function startAnimation() {
    if (!imgEl.value) return;
    const el = imgEl.value;
    gsap.set(el, { opacity: 0 });

    if (effect.value === 'fade') {
        gsap.timeline()
            .to(el, { opacity: 1, duration: fadeInTime.value })
            .to({}, { duration: Math.max(0, duration.value - fadeInTime.value - fadeOutTime.value) })
            .to(el, { opacity: 0, duration: fadeOutTime.value });
    } else if (effect.value === 'scroll') {
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const rect = el.getBoundingClientRect();
        const elWidth = rect.width;
        const elHeight = rect.height;

        gsap.set(el, { position: 'absolute', left: '50%', top: '50%', xPercent: -50, yPercent: -50, x: 0, y: 0, opacity: 0 });

        let travelX = 0;
        let travelY = 0;
        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;

        if (scrollDirection.value === 'up') {
            travelY = viewportHeight / 2 + elHeight / 2 + 20;
            startY = travelY;
            endY = -travelY;
        } else if (scrollDirection.value === 'down') {
            travelY = viewportHeight / 2 + elHeight / 2 + 20;
            startY = -travelY;
            endY = travelY;
        } else if (scrollDirection.value === 'left') {
            travelX = viewportWidth / 2 + elWidth / 2 + 20;
            startX = travelX;
            endX = -travelX;
        } else if (scrollDirection.value === 'right') {
            travelX = viewportWidth / 2 + elWidth / 2 + 20;
            startX = -travelX;
            endX = travelX;
        }

        gsap.set(el, { x: startX, y: startY, opacity: 1 });
        gsap.to(el, {
            x: endX,
            y: endY,
            duration: duration.value,
            ease: 'linear'
        });
    } else if (effect.value === 'static') {
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