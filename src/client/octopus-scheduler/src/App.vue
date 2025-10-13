<script setup lang="ts">
import type { EventPollingService } from './model/applications/event-polling-service';
import { inject, watch, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAudio } from '../../packages/shared-composables/src/use-audio';
import FullScreenVideo from './ui/components/full-screen-video.vue';
import FullScreenImage from './ui/components/full-screen-image.vue';

const eventPollingService = inject<EventPollingService>('eventPollingService');
if (!eventPollingService) {
    throw new Error('EventPollingService not provided');
}

const router = useRouter();
const audio = useAudio();

const videoRef = ref();
const imageRef = ref();

watch(() => eventPollingService.state.showVideoModal, (visible) => {
    if (!visible && videoRef.value?.stopAndClose) {
        videoRef.value.stopAndClose(300);
    }
});

watch(() => eventPollingService.state.showImageModal, (visible) => {
    if (!visible && imageRef.value?.hide) {
        imageRef.value.hide(300);
    }
});

watch(() => eventPollingService.state.nextPage, (nextPageUrl) => {
    if (nextPageUrl) {
        router.replace({ path: nextPageUrl });
        eventPollingService.state.nextPage = null;
    }
});

watch(
    () => eventPollingService.state.isAudioPlaying,
    async (isPlaying) => {
        if (isPlaying && eventPollingService.state.audioUrl) {
            await audio.load(eventPollingService.state.audioUrl);
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
        <FullScreenVideo ref="videoRef" v-if="eventPollingService.state.showVideoModal"
            :src="eventPollingService.state.videoUrl" :visible="eventPollingService.state.showVideoModal"
            :fadeOutDuration="0" :onClose="() => eventPollingService.state.showVideoModal = false" />
        <FullScreenImage ref="imageRef" v-if="eventPollingService.state.showImageModal"
            :src="eventPollingService.state.imageAssetUrl" :visible="eventPollingService.state.showImageModal"
            :fadeOutDuration="0" :onClose="() => eventPollingService.state.showImageModal = false" />
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
