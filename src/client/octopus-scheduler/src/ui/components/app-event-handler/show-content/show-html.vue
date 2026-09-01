<template>
    <div class="fullscreen-html">
        <div class="html-content" v-html="htmlContent" :class="displayModeClass"></div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { container } from 'tsyringe';
import { AssetService } from 'model/applications/assets/asset-service';
import { AppEventService } from 'model/applications/app-event/app-event-service';

interface Props {
    // support legacy `content` (encoded html) or new `id` (localStorage key suffix)
    content?: string;
    id?: string;
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
let prevHtmlOverflow: string | null = null;
let prevBodyOverflow: string | null = null;

async function loadHtmlContent() {
    // cleanup previous created urls and restore overflow before loading new content
    try {
        createdUrls.forEach((u: string) => {
            try { URL.revokeObjectURL(u); } catch (e) { }
        });
        createdUrls.length = 0;
        if (prevHtmlOverflow !== null) {
            try { document.documentElement.style.overflow = prevHtmlOverflow; } catch { }
        }
        if (prevBodyOverflow !== null) {
            try { document.body.style.overflow = prevBodyOverflow; } catch { }
        }
    } catch (e) {
        // ignore
    }

    // Prevent page from showing browser scrollbars while fullscreen html is displayed
    try {
        prevHtmlOverflow = document.documentElement.style.overflow || null;
        prevBodyOverflow = document.body.style.overflow || null;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
    } catch (e) {
        // ignore (SSR or restricted env)
    }

    let html = '';
    // prefer legacy encoded content if provided
    if (props.content) {
        try {
            html = decodeURIComponent(props.content);
        } catch (e) {
            html = props.content as string;
        }
    } else if ((props as any).id) {
        const id = (props as any).id as string;
        const isTemp = (route.query && route.query._temp === '1');
        if (isTemp) {
            try {
                html = sessionStorage.getItem(`octopus:html:${id}`) || '';
            } catch (e) {
                console.error('Failed to read html content from sessionStorage', e);
                html = '';
            }
        } else {
            // Try to load the event by id and read htmlString
            try {
                const appEventService = container.resolve(AppEventService);
                const ev = await appEventService.getEventById(id);
                if (ev && (ev as any).htmlString) {
                    html = (ev as any).htmlString as string;
                } else {
                    // fallback to legacy localStorage
                    try {
                        html = localStorage.getItem(`octopus:html:${id}`) || '';
                    } catch (e) {
                        html = '';
                    }
                }
            } catch (e) {
                console.error('Failed to load event by id', e);
                try {
                    html = localStorage.getItem(`octopus:html:${id}`) || '';
                } catch (err) {
                    html = '';
                }
            }
        }
    }
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
}

onMounted(() => {
    // initial load
    void loadHtmlContent();
    // reload whenever route changes (e.g. same route/params re-pushed)
    watch(() => route.fullPath, () => {
        void loadHtmlContent();
    });
});

onUnmounted(() => {
    createdUrls.forEach((u: string) => {
        try { URL.revokeObjectURL(u); } catch (e) { }
    });
    // Restore previous overflow styles
    try {
        if (prevHtmlOverflow !== null) document.documentElement.style.overflow = prevHtmlOverflow;
        else document.documentElement.style.removeProperty('overflow');
        if (prevBodyOverflow !== null) document.body.style.overflow = prevBodyOverflow;
        else document.body.style.removeProperty('overflow');
    } catch (e) {
        // ignore
    }
});
</script>

<style scoped>
.fullscreen-html {
    position: fixed;
    inset: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    z-index: 9999;
    color: white;
    overflow: hidden;
}

.html-content {
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: 0;
    margin: 0;
    overflow: auto;
    -ms-overflow-style: none;
    /* IE and Edge */
    scrollbar-width: none;
    /* Firefox */
}

.html-content::-webkit-scrollbar {
    display: none;
    /* Chrome, Safari */
}

/* Reset common default margins inside injected HTML so content sits flush */
.html-content * {
    margin: 0 !important;
    padding: 0 !important;
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