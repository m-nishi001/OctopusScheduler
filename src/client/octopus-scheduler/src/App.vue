<script setup lang="ts">
import type { EventPollingService } from './model/applications/event-polling-service';
import { inject, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAudio } from '../../packages/shared-composables/src/use-audio';
import FullScreenVideo from './ui/components/full-screen-video.vue';
import FullScreenImage from './ui/components/full-screen-image.vue';
import FullScreenHtml from './ui/components/full-screen-html.vue';

const eventPollingService = inject<EventPollingService>('eventPollingService');
const globalState = inject<any>('globalState');
if (!eventPollingService || !globalState) {
    throw new Error('Services not provided');
}

const router = useRouter();
const audio = useAudio();

const videoRef = ref();
const imageRef = ref();

watch(() => globalState.showVideoModal, (visible) => {
    if (!visible && videoRef.value?.stopAndClose) {
        videoRef.value.stopAndClose(300);
    }
});

watch(() => globalState.showImageModal, (visible) => {
    if (!visible && imageRef.value?.hide) {
        imageRef.value.hide(300);
    }
});

watch(() => globalState.nextPage, (nextPageUrl) => {
    if (nextPageUrl) {
        router.replace({ path: nextPageUrl });
        globalState.nextPage = null;
    }
});

watch(
    () => globalState.isAudioPlaying,
    async (isPlaying) => {
        if (isPlaying && globalState.audioUrl) {
            await audio.load(globalState.audioUrl);
            await audio.play();
        } else if (!isPlaying) {
            await audio.stop();
        }
    }
);
</script>

<template>
    <div>
        <router-view />
        <FullScreenVideo ref="videoRef" v-if="globalState.showVideoModal" :src="globalState.videoUrl"
            :visible="globalState.showVideoModal" :fadeOutDuration="0"
            :onClose="() => globalState.showVideoModal = false" />
        <FullScreenImage ref="imageRef" v-if="globalState.showImageModal" :src="globalState.imageAssetUrl"
            :visible="globalState.showImageModal" :fadeOutDuration="0"
            :onClose="() => globalState.showImageModal = false" />
        <FullScreenHtml v-if="globalState.showHtmlModal" :htmlContent="globalState.htmlContent"
            :visible="globalState.showHtmlModal" :fadeOutDuration="0"
            :onClose="() => globalState.showHtmlModal = false" />
    </div>
</template>

<style scoped>
.logo {
    height: 6em;
    padding: 1.5em;
    will-change: filter;
    transition: filter 300ms;
}

.logo:hover {
    filter: drop-shadow(0 0 2em #646cffaa);
}

.logo.vue:hover {
    filter: drop-shadow(0 0 2em #42b883aa);
}
</style>
