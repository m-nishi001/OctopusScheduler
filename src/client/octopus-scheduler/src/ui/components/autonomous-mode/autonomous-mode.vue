<template>
    <div class="autonomous-mode dark-bg">
        <div class="auto-content">
            <h2 class="auto-title">
                <span class="auto-icon">🤖</span> 自立モード実行中
            </h2>
            <div class="event-section">
                <div class="event-block">
                    <h3>今から開始するイベント</h3>
                    <div class="event-value">{{ localState.upcomingEvent }}</div>
                </div>
                <div class="event-block">
                    <h3>今実行しているイベント</h3>
                    <div class="event-value">{{ localState.currentEvent }}</div>
                </div>
                <div class="event-block">
                    <h3>今から終了するイベント</h3>
                    <div class="event-value">{{ localState.endingEvent }}</div>
                </div>
            </div>
            <div class="control-section">
                <div class="polling-controls">
                    <button class="main-btn" @click="onStartPolling" :disabled="localState.isPolling">
                        <span class="btn-icon">🔄</span> ポーリング開始
                    </button>
                    <button class="main-btn" @click="onStopPolling" :disabled="!localState.isPolling">
                        <span class="btn-icon">⏹️</span> ポーリング停止
                    </button>
                    <span class="event-value" style="margin-left:1em;">
                        ポーリング状態: <b>{{ localState.isPolling ? '稼働中' : '停止中' }}</b>
                    </span>
                </div>
                <div class="audio-controls">
                    <button class="main-btn" @click="onPlayAudio">
                        <span class="btn-icon">🎵</span> 音楽再生
                    </button>
                    <button class="main-btn" @click="onStopAudio">
                        <span class="btn-icon">⏹️</span> 音楽停止
                    </button>
                    <span v-if="globalState.audioError" class="error-msg">{{
                        (globalState.audioError as any)?.message }}</span>
                </div>
                <div class="video-controls">
                    <button class="main-btn" @click="globalState.showVideoModal = true">
                        <span class="btn-icon">🎬</span> 動画再生
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { inject, reactive, onMounted } from 'vue';
import type { IScheduleEventEntity } from 'src/model/domains/schedule-event/i-schedule-event-entity';
import { PlayAudioEventHandler } from './handlers/play-audio-event-handler';
import { ShowContentEventHandler } from './handlers/show-content-event-handler';
import { TransitionPageEventHandler } from './handlers/transition-page-event-handler';

const eventPollingService = inject('eventPollingService') as any;
const assetService = inject('assetService') as any;
const globalState = inject('globalState') as any;

const localState = reactive({
    upcomingEvent: "",
    currentEvent: "",
    endingEvent: "",
    isPolling: false,
});

const onEvents = async (startEvents: IScheduleEventEntity[], endEvents: IScheduleEventEntity[]) => {
    localState.upcomingEvent = startEvents.length > 0 ? startEvents.map((e) => e.type).join(", ") : "（なし）";
    localState.currentEvent = startEvents.length > 0 ? startEvents.map((e) => e.type).join(", ") : "（なし）";
    localState.endingEvent = endEvents.length > 0 ? endEvents.map((e) => e.type).join(", ") : "（なし）";

    for (const event of startEvents) {
        await event.execute(true);
    }
    for (const event of endEvents) {
        await event.execute(false);
    }
};

const onPlayAudio = async () => {
    if (globalState.audioUrl) {
        globalState.isAudioPlaying = true;
    }
};

const onStopAudio = async () => {
    globalState.isAudioPlaying = false;
};

const onStartPolling = () => {
    localState.isPolling = true;
    eventPollingService.startPolling();
};

const onStopPolling = () => {
    localState.isPolling = false;
    eventPollingService.stopPolling();
};

onMounted(() => {
    eventPollingService.setOnEventsCallback(onEvents);
    new PlayAudioEventHandler(globalState, assetService);
    new ShowContentEventHandler(globalState, assetService);
    new TransitionPageEventHandler(globalState);
});
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
