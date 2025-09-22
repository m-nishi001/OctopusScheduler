<template>
    <div class="autonomous-mode dark-bg">
        <div class="auto-content">
            <h2 class="auto-title">
                <span class="auto-icon">🤖</span> 自立モード実行中
            </h2>
            <div class="event-section">
                <div class="event-block">
                    <h3>今から開始するイベント</h3>
                    <div class="event-value">{{ upcomingEvent }}</div>
                </div>
                <div class="event-block">
                    <h3>今実行しているイベント</h3>
                    <div class="event-value">{{ currentEvent }}</div>
                </div>
                <div class="event-block">
                    <h3>今から終了するイベント</h3>
                    <div class="event-value">{{ endingEvent }}</div>
                </div>
            </div>
            <div class="control-section">
                <div class="audio-controls">
                    <button class="main-btn" @click="onPlayAudio">
                        <span class="btn-icon">🎵</span> 音楽再生
                    </button>
                    <button class="main-btn" @click="onStopAudio">
                        <span class="btn-icon">⏹️</span> 音楽停止
                    </button>
                    <span v-if="audioError" class="error-msg">{{ audioError?.message }}</span>
                </div>
                <div class="video-controls">
                    <button class="main-btn" @click="showVideoModal = true">
                        <span class="btn-icon">🎬</span> 動画再生
                    </button>
                </div>
            </div>
            <FullScreenVideo ref="fullScreenVideoRef" v-if="showVideoModal" :src="videoUrl" :visible="showVideoModal"
                :fadeOutDuration="0" :onClose="closeVideoModal" />
            <FullScreenImage ref="fullScreenImageRef" v-if="showImageModal" :src="imageAssetUrl"
                :visible="showImageModal" :fadeOutDuration="0" :onClose="closeImageModal" />
        </div>
        <div v-if="showVideoModal" class="modal-bg">
            <div class="modal">
                <!-- 動画停止ボタンは不要なので削除 -->
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAudio } from '../../../../../packages/shared-composables/src/use-audio';
import { usePolling } from '../../../../../packages/shared-composables/src/use-polling';
import FullScreenVideo from '../FullScreenVideo.vue';
import FullScreenImage from '../FullScreenImage.vue';
import { useRouter } from 'vue-router';
import { container } from 'tsyringe';
import type { IScheduleEventService } from '../../../model/applications/schedule-event/ischedule-event-service';
import type { AssetService } from '../../../model/applications/assets/asset-service';

const upcomingEvent = ref('');
const currentEvent = ref('');
const endingEvent = ref('');

const { load, play, stop, error: audioError } = useAudio();

const audioUrl = ref('');
const videoUrl = ref('');
const imageAssetUrl = ref('');

const showVideoModal = ref(false);
const showImageModal = ref(false);
const fullScreenVideoRef = ref();
const fullScreenImageRef = ref();

const router = useRouter();

const scheduleEventService = container.resolve<IScheduleEventService>('IScheduleEventService');
const assetService = container.resolve<AssetService>('AssetService');

const isAudioPlaying = ref(false);

const handleEvents = async () => {
    const { startEvents, endEvents } = await scheduleEventService.getCurrentScheduleEvent();
    console.log('Start Events:', startEvents);
    console.log('End Events:', endEvents);

    upcomingEvent.value = startEvents.length > 0 ? startEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';
    currentEvent.value = startEvents.length > 0 ? startEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';
    endingEvent.value = endEvents.length > 0 ? endEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';

    for (const event of startEvents) {
        const strategy = strategyMap[event.scheduleEventType];
        if (strategy) await strategy.start(event);
    }
    for (const event of endEvents) {
        const strategy = strategyMap[event.scheduleEventType];
        if (strategy) await strategy.end(event);
    }

    if (startEvents.length > 0) {
        await scheduleEventService.markEventsAsStarted({ scheduleEventIds: startEvents.map(e => e.scheduleEventId) });
    }
    if (endEvents.length > 0) {
        await scheduleEventService.markEventsAsEnded({ scheduleEventIds: endEvents.map(e => e.scheduleEventId) });
    }
};

const { start } = usePolling(handleEvents, 5000, { immediate: true });

onMounted(() => {
    start();
});

const onPlayAudio = async () => {
    if (audioUrl.value) {
        await load(audioUrl.value);
        await play();
        isAudioPlaying.value = true;
    }
};

const onStopAudio = async () => {
    await stop();
    isAudioPlaying.value = false;
};

const closeVideoModal = () => {
    showVideoModal.value = false;
};

const closeImageModal = () => {
    showImageModal.value = false;
};

// Strategyインターフェース
interface ScheduleEventStrategy {
    start(event: any): Promise<void>;
    end(event: any): Promise<void>;
}

// 音楽再生イベントStrategy
class PlayAudioEventStrategy implements ScheduleEventStrategy {
    async start(event: any) {
        if (event.scheduleEventDetail?.audioId) {
            const asset = await assetService.getAssetById(event.scheduleEventDetail.audioId);
            if (asset && asset.assetData) {
                audioUrl.value = asset.assetData;
                await load(audioUrl.value);
                await play({ fadeIn: 0 });
                isAudioPlaying.value = true;
            }
        }
    }
    async end(event: any) {
        if (isAudioPlaying.value) {
            await stop(event.scheduleEventDetail?.fadeOutDuration);
            isAudioPlaying.value = false;
        }
    }
}

// 動画再生イベントStrategy
class PlayMovieEventStrategy implements ScheduleEventStrategy {
    async start(event: any) {
        if (event.scheduleEventDetail?.movieId) {
            const asset = await assetService.getAssetById(event.scheduleEventDetail.movieId);
            if (asset && asset.assetData) {
                videoUrl.value = asset.assetData;
                showVideoModal.value = true;
            }
        }
    }
    async end(event: any) {
        fullScreenVideoRef.value?.stopAndClose(event?.scheduleEventDetail?.fadeOutDuration);
    }
}

// 画像表示イベントStrategy
class ShowImageEventStrategy implements ScheduleEventStrategy {
    async start(event: any) {
        if (event.scheduleEventDetail?.imageId) {
            const asset = await assetService.getAssetById(event.scheduleEventDetail.imageId);
            if (asset && asset.assetData) {
                imageAssetUrl.value = asset.assetData;
                showImageModal.value = true;
            }
        }
    }
    async end(event: any) {
        fullScreenImageRef.value?.hide(event?.scheduleEventDetail?.fadeOutDuration);
    }
}

// 画面遷移イベントStrategy
class TransitionPageEventStrategy implements ScheduleEventStrategy {
    async start(event: any) {
        if (event.scheduleEventDetail?.transitionUrl) {
            router.replace({ hash: event.scheduleEventDetail.transitionUrl });
        }
    }
    async end() {
        // 終了処理不要
    }
}

const strategyMap: Record<string, ScheduleEventStrategy> = {
    PlayAudioEvent: new PlayAudioEventStrategy(),
    PlayMovieEvent: new PlayMovieEventStrategy(),
    ShowImageEvent: new ShowImageEventStrategy(),
    TransitionPageEvent: new TransitionPageEventStrategy(),
};
</script>
<style scoped>
.autonomous-mode {
    background: linear-gradient(135deg, #181818 0%, #222 100%);
    color: #fff;
    min-height: 100vh;
    width: 100vw;
    height: 100vh;
    display: flex;
    flex-direction: column;
}

.auto-content {
    width: 100vw;
    height: 100vh;
    padding: 2em;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    /* ベース層の背景・枠装飾を削除 */
}

.auto-title {
    font-size: 2em;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 2em;
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: #fff;
    text-shadow: 0 2px 12px #000a;
}

.auto-icon {
    font-size: 1.3em;
}

.event-section {
    width: 100%;
    margin-bottom: 2em;
    display: flex;
    flex-direction: column;
    gap: 1.2em;
}

.event-block {
    background: #232323;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    padding: 1em 1.2em;
}

.event-block h3 {
    font-size: 1.1em;
    margin-bottom: 0.5em;
    color: #8fd3ff;
}

.event-value {
    font-size: 1.1em;
    color: #fff;
    word-break: break-all;
}

.control-section {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 1.5em;
}

.audio-controls,
.video-controls {
    display: flex;
    gap: 1.2em;
    justify-content: center;
}

.main-btn {
    font-size: 1.05em;
    font-weight: 600;
    padding: 0.8em 2em;
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
    outline: none;
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7em;
}

.main-btn .btn-icon {
    font-size: 1.2em;
}

.main-btn:hover,
.main-btn:focus {
    background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px) scale(1.04);
}

.main-btn:active {
    background: #1a1a1a;
    transform: scale(0.98);
}

.error-msg {
    color: #ff6b6b;
    margin-left: 1em;
    font-size: 0.95em;
}


.modal-bg {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal {
    background: #222;
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
    min-width: 320px;
    max-width: 90vw;
    width: 90vw;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    align-items: center;
}

.modal video {
    border-radius: 8px;
    background: #000;
    width: 100%;
    max-height: 60vh;
}

.close-btn {
    margin-top: 1rem;
}

@media (max-width: 600px) {
    .auto-content {
        width: 100vw;
        height: 100vh;
        padding: 0.5em;
    }

    .auto-title {
        font-size: 1.2em;
    }

    .event-block {
        padding: 0.7em 0.5em;
    }

    .main-btn {
        font-size: 0.95em;
        padding: 0.7em 1.2em;
    }

    .modal {
        padding: 1rem;
        min-width: 200px;
        max-width: 98vw;
    }

    .audio-controls,
    .video-controls {
        gap: 0.7em;
        flex-direction: column;
        align-items: stretch;
    }
}
</style>
