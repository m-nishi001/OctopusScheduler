
<template>
  <div class="autonomous-mode dark-bg">
    <h2>自立モード実行中</h2>
    <div>
      <h3>今から開始するイベント</h3>
      <div>{{ upcomingEvent }}</div>
    </div>
    <div>
      <h3>今実行しているイベント</h3>
      <div>{{ currentEvent }}</div>
    </div>
    <div>
      <h3>今から終了するイベント</h3>
      <div>{{ endingEvent }}</div>
    </div>
    <div class="audio-controls">
      <button @click="onPlayAudio">音楽再生</button>
      <button @click="onStopAudio">音楽停止</button>
      <span v-if="audioError" style="color: red;">{{ audioError?.message }}</span>
    </div>
    <div class="video-controls">
      <button @click="showVideoModal = true">動画再生</button>
      <button @click="onStopVideo">動画停止</button>
    </div>
    <div v-if="showVideoModal" class="modal-bg">
      <div class="modal">
        <video ref="videoRef" :src="videoUrl" controls autoplay style="width:100%;height:auto;"></video>
        <button @click="closeVideoModal" class="close-btn">閉じる</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useAudio } from '../../../../../packages/shared-composables/src/use-audio';
import { usePolling } from '../../../../../packages/shared-composables/src/use-polling';
import { container } from 'tsyringe';
import type { IScheduleEventService } from '../../../model/applications/schedule-event/ischedule-event-service';
import type { AssetService } from '../../../model/applications/assets/asset-service';

const upcomingEvent = ref('');
const currentEvent = ref('');
const endingEvent = ref('');

const { load, play, stop, error: audioError } = useAudio();

const audioUrl = ref('');
const videoUrl = ref('');

const showVideoModal = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);

// DI解決
const scheduleEventService = container.resolve<IScheduleEventService>('IScheduleEventService');
const assetService = container.resolve<AssetService>('AssetService');

// 再生状態管理
const isAudioPlaying = ref(false);
const isVideoPlaying = ref(false);

const handleEvents = async () => {
  const { startEvents, endEvents } = await scheduleEventService.getCurrentScheduleEvent();

  // UI表示用
  upcomingEvent.value = startEvents.length > 0 ? startEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';
  currentEvent.value = startEvents.length > 0 ? startEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';
  endingEvent.value = endEvents.length > 0 ? endEvents.map(e => e.scheduleEventName).join(', ') : '（なし）';

  // 音楽再生イベント
  const audioStart = startEvents.find(e => e.scheduleEventType?.scheduleEventType === 'play-audio');
  const audioEnd = endEvents.find(e => e.scheduleEventType?.scheduleEventType === 'play-audio');
  if (audioStart && audioStart.scheduleEventDetail?.assetId) {
    const asset = await assetService.getAssetById(audioStart.scheduleEventDetail.assetId);
    if (asset && asset.assetData) {
      audioUrl.value = asset.assetData;
      await load(audioUrl.value);
      await play();
      isAudioPlaying.value = true;
    }
  }
  if (audioEnd && isAudioPlaying.value) {
    await stop();
    isAudioPlaying.value = false;
  }

  // 動画再生イベント
  const videoStart = startEvents.find(e => e.scheduleEventType?.scheduleEventType === 'play-movie');
  const videoEnd = endEvents.find(e => e.scheduleEventType?.scheduleEventType === 'play-movie');
  if (videoStart && videoStart.scheduleEventDetail?.assetId) {
    const asset = await assetService.getAssetById(videoStart.scheduleEventDetail.assetId);
    if (asset && asset.assetData) {
      videoUrl.value = asset.assetData;
      if (videoRef.value) {
        videoRef.value.src = videoUrl.value;
        videoRef.value.play();
        isVideoPlaying.value = true;
      }
    }
  }
  if (videoEnd && isVideoPlaying.value && videoRef.value) {
    videoRef.value.pause();
    videoRef.value.currentTime = 0;
    isVideoPlaying.value = false;
  }
};

const { start } = usePolling(handleEvents, 5000, { immediate: true });

onMounted(() => {
  console.log('[autonomous-mode] ポーリング開始');
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
  onStopVideo();
};
const onStopVideo = () => {
  if (videoRef.value) {
    videoRef.value.pause();
    videoRef.value.currentTime = 0;
    isVideoPlaying.value = false;
  }
};
</script>
    .autonomous-mode h3 {
      margin-top: 1.5rem;
      font-size: 1.2rem;
    }
    .autonomous-mode > div {
      width: 100%;
      max-width: 600px;
    }
    .audio-controls, .video-controls {
      margin-top: 2rem;
      display: flex;
      gap: 2rem;
      justify-content: center;
    }
    .audio-controls button, .video-controls button, .close-btn {
      font-size: 1em;
      padding: 0.8em 2em;
      background: #333;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transition: background 0.2s;
    }
    .audio-controls button:hover, .video-controls button:hover, .close-btn:hover {
      background: #444;
    }
    .modal-bg {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    }
    .modal {
      background: #222;
      padding: 2rem;
      border-radius: 12px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.4);
      min-width: 320px;
      max-width: 640px;
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
      .autonomous-mode {
        padding: 1rem;
      }
      .modal {
        padding: 1rem;
        min-width: 200px;
        max-width: 95vw;
      }
      .audio-controls, .video-controls {
        gap: 1rem;
        flex-direction: column;
        align-items: stretch;
      }
    }
