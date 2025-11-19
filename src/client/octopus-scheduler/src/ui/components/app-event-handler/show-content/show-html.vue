<template>
    <div class="fullscreen-html">
        <div class="html-content" v-html="htmlContent" :class="displayModeClass"></div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from 'model/applications/assets/asset-service';

interface Props {
    content: string;
}

const props = defineProps<Props>();
const route = useRoute();

const htmlContent = ref('');
const assetService = container.resolve(AssetService);

const displayMode = ref(route.query.displayMode as string || 'fade');
const manual = ref((route.query.manual as string) === 'true');

const displayModeClass = computed(() => {
    return displayMode.value === 'fade' ? 'fade-in' : displayMode.value;
});
const createdUrls: string[] = [];

onMounted(async () => {
    let html = decodeURIComponent(props.content || '');
    const assetRegex = /\{\{asset:(image|video):([^}]+)\}\}/g;
    const assetIds = [];
    let match;
    while ((match = assetRegex.exec(html)) !== null) {
        assetIds.push(match[2]);
    }
    const assetMap = new Map<string, string>();
    for (const id of assetIds) {
        try {
            const asset = await assetService.getAssetById(id);
            if (asset) {
                if ((asset as any).blob) {
                    try {
                        const url = URL.createObjectURL((asset as any).blob);
                        createdUrls.push(url);
                        assetMap.set(id, url);
                    } catch (err) {
                        console.error('Failed to create object URL for asset in html', err);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load asset:', id, e);
        }
    }
    html = html.replace(assetRegex, (match, type, assetId) => {
        const dataUrl = assetMap.get(assetId);
        if (!dataUrl) return match;
        if (type === 'image') {
            return `<img src="${dataUrl}" alt="asset" />`;
        } else if (type === 'video') {
            return `<video src="${dataUrl}" controls autoplay></video>`;
        }
        return match;
    });
    htmlContent.value = html;
});

onUnmounted(() => {
    createdUrls.forEach((u: string) => {
        try { URL.revokeObjectURL(u); } catch (e) { }
    });
});
</script>

<style scoped>
.fullscreen-html {
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
    color: white;
}

.html-content {
    max-width: 90vw;
    max-height: 80vh;
    overflow: auto;
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