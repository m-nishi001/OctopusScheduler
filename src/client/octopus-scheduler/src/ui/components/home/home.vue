<template>
  <div class="home dark-bg">
    <div class="home-content">
      <h1 class="home-title">
        <span class="octo-icon">🐙</span> Octopus Scheduler
      </h1>
      <div class="btn-group">
        <button class="main-btn" @click="goToSettings">
          <span class="btn-icon">⚙️</span> 設定画面
        </button>
        <button class="main-btn" @click="goToJackpotGame">
          <span class="btn-icon">🎰</span> Jackpot Game
        </button>
        <button class="main-btn" @click="goToQuizGame">
          <span class="btn-icon">🎯</span> Quiz Game
        </button>
        <button class="main-btn" @click="goToCardGame">
          <span class="btn-icon">�</span> Card Game
        </button>
      </div>
      <div class="autonomous-section">
        <h2>自立モード</h2>
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
        </div>
      </div>
      <p class="desc">ここにロード画面や初期同期処理を追加予定。</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import type { IScheduleEvent } from '../../../model/domains/schedule-event/schedule-event';
import { EventPollingService } from '../../../model/applications/event-polling-service';
import { container } from 'tsyringe';

const router = useRouter();
const eventPollingService = container.resolve(EventPollingService);

const localState = reactive({
  upcomingEvent: "",
  currentEvent: "",
  endingEvent: "",
  isPolling: false,
});

const goToSettings = () => router.push({ name: 'settings' });
const goToJackpotGame = () => router.push('/jackpot-home');
const goToQuizGame = () => router.push('/quiz-admin');
const goToCardGame = () => router.push('/card-home');

const onEvents = async (startEvents: IScheduleEvent[], endEvents: IScheduleEvent[]) => {
  localState.upcomingEvent = startEvents.length > 0 ? startEvents.map((e) => e.type).join(", ") : "（なし）";
  localState.currentEvent = startEvents.length > 0 ? startEvents.map((e) => e.type).join(", ") : "（なし）";
  localState.endingEvent = endEvents.length > 0 ? endEvents.map((e) => e.type).join(", ") : "（なし）";

  for (const event of startEvents) await event.execute(true);
  for (const event of endEvents) await event.execute(false);
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
  // 一時的にポーリングを停止するためコメントアウト
  // eventPollingService.startPolling();
  // localState.isPolling = true;
});
</script>

<style scoped>
.home {
  background: linear-gradient(135deg, #181818 0%, #222 100%);
  color: #fff;
  min-height: 100vh;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.home-content {
  width: 100vw;
  height: 100vh;
  padding: 2em;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.home-title {
  font-size: 2.2em;
  font-weight: 700;
  letter-spacing: 0.04em;
  margin-bottom: 2em;
  display: flex;
  align-items: center;
  gap: 0.5em;
  color: #fff;
  text-shadow: 0 2px 12px #000a;
}

.octo-icon {
  font-size: 1.3em;
}

.btn-group {
  display: flex;
  gap: 1.5em;
  margin-bottom: 2em;
  width: 100%;
  justify-content: center;
}

.main-btn {
  font-size: 1.1em;
  font-weight: 600;
  padding: 0.9em 2.2em;
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

.autonomous-section {
  width: 100%;
  margin-bottom: 2em;
  display: flex;
  flex-direction: column;
  gap: 1.2em;
}

.autonomous-section h2 {
  font-size: 1.5em;
  color: #8fd3ff;
  text-align: center;
}

.event-section {
  width: 100%;
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

.polling-controls {
  display: flex;
  gap: 1.2em;
  justify-content: center;
}

.desc {
  color: #bbb;
  font-size: 1em;
  margin-top: 1em;
  text-align: center;
}

@media (max-width: 600px) {
  .home-content {
    width: 100vw;
    height: 100vh;
    padding: 0.5em;
  }

  .home-title {
    font-size: 1.3em;
  }

  .main-btn {
    font-size: 1em;
    padding: 0.7em 1.2em;
  }

  .event-block {
    padding: 0.7em 0.5em;
  }

  .polling-controls {
    gap: 0.7em;
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
