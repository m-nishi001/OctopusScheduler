<template>
  <div>
    <h2>イベント編集画面</h2>
    <div class="controls">
      <button @click="showAddDialog = true">イベント追加</button>
      <p v-if="error" class="error-message">{{ error }}</p>
      <p v-if="loading" class="loading-message">読み込み中...</p>
    </div>
    <EventList :events="events" @edit="onEdit" @delete="onDelete" />

    <!-- 編集ダイアログ表示（種別ごとに切り替え） -->
    <AudioEventDialog v-if="showEditDialog && selectedEvent?.type === 'AudioEvent'" :event="selectedEvent"
      @close="closeEditDialog" />
    <ImageEventDialog v-if="showEditDialog && selectedEvent?.type === 'ImageEvent'" :event="selectedEvent"
      @close="closeEditDialog" />
    <VideoEventDialog v-if="showEditDialog && selectedEvent?.type === 'VideoEvent'" :event="selectedEvent"
      @close="closeEditDialog" />
    <TransitionEventDialog v-if="showEditDialog && selectedEvent?.type === 'TransitionEvent'" :event="selectedEvent"
      @close="closeEditDialog" />

    <!-- 追加ダイアログ -->
    <div v-if="showAddDialog" class="dialog-backdrop">
      <div class="dialog">
        <h3>イベント追加</h3>
        <form @submit.prevent="addEvent">
          <label>名前：<input v-model="newEvent.name" required /></label><br />
          <label>種別：
            <select v-model="newEvent.type">
              <option value="AudioEvent">AudioEvent</option>
              <option value="ImageEvent">ImageEvent</option>
              <option value="VideoEvent">VideoEvent</option>
              <option value="TransitionEvent">TransitionEvent</option>
            </select>
          </label><br />
          <label v-if="newEvent.type !== 'TransitionEvent'">
            アセット：
            <select v-model="newEvent.assetName">
              <option v-for="a in assetOptions[newEvent.type]" :key="a" :value="a">{{ a }}</option>
            </select>
          </label><br />
          <div style="margin-top:1em;">
            <button type="submit">追加</button>
            <button type="button" @click="showAddDialog = false">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import EventList from './EventList.vue';
import AudioEventDialog from './AudioEventDialog.vue';
import ImageEventDialog from './ImageEventDialog.vue';
import VideoEventDialog from './VideoEventDialog.vue';
import TransitionEventDialog from './TransitionEventDialog.vue';
import { useLocalStorage } from '../../../packages/shared-composables/src/use-localstorage';
import { ScheduleService } from '../applications/schedule/schedule-service';

// --- 型定義 ---
type EventType = 'AudioEvent' | 'ImageEvent' | 'VideoEvent' | 'TransitionEvent';
type Event = { id: string; name: string; type: EventType; assetName?: string };

// --- refs ---
const events = ref<Event[]>([]);
const showAddDialog = ref(false);
const showEditDialog = ref(false);
const selectedEvent = ref<Event | null>(null);
const newEvent = ref<Event>({ id: '', name: '', type: 'AudioEvent', assetName: '' });
const loading = ref(false);
const error = ref('');

const { getAll } = useLocalStorage();
const assetOptions = ref<Record<EventType, string[]>>({
  AudioEvent: [],
  ImageEvent: [],
  VideoEvent: [],
  TransitionEvent: []
});

// --- 関数 ---
/**
 * アセットオプションを非同期で取得します。
 */
async function fetchAssetOptions() {
  try {
    const allAssets = Array.from((await getAll<{ id: string; name: string }>()).values()).map(a => a.name);
    assetOptions.value.AudioEvent = allAssets;
    assetOptions.value.ImageEvent = allAssets;
    assetOptions.value.VideoEvent = allAssets;
  } catch (e) {
    console.error('アセットオプションの取得に失敗しました:', e);
  }
}

/**
 * すべてのイベントを非同期で取得します。
 */
async function fetchEvents() {
  loading.value = true;
  error.value = '';
  try {
    const schedules = await new ScheduleService().getAllSchedules();
    const allEvents: any[] = [];
    schedules.forEach(schedule => {
      const scheduleEvents = schedule.getEvents();
      allEvents.push(...scheduleEvents);
    });

    events.value = allEvents.map((e: any) => {
      let assetName = '';
      const detail = e.getDetail ? e.getDetail() : undefined;
      if (detail) {
        if ('assetName' in detail) {
          assetName = (detail as any).assetName;
        } else if ('audioID' in detail) {
          assetName = (detail as any).audioID;
        } else if ('imageID' in detail) {
          assetName = (detail as any).imageID;
        } else if ('videoID' in detail) {
          assetName = (detail as any).videoID;
        }
      }
      return {
        id: e.id,
        name: e.getEventName(),
        type: (e as any).type ?? 'AudioEvent',
        assetName
      };
    });
  } catch (e) {
    error.value = 'イベント一覧の取得に失敗しました';
  }
  loading.value = false;
}

/**
 * イベント編集ダイアログを開きます。
 * @param event 編集するイベント
 */
function onEdit(event: Event) {
  selectedEvent.value = event;
  showEditDialog.value = true;
}

/**
 * イベントを削除します。
 * @param event 削除するイベント
 */
async function onDelete(event: Event) {
  // `window.confirm`の代わりにカスタムUIを使用してください。
  // ここでは代替としてコンソールにログを出力します。
  console.log(`削除リクエスト: ${event.name}`);

  loading.value = true;
  error.value = '';
  try {
    const schedules = await new ScheduleService().getAllSchedules();
    for (const schedule of schedules) {
      const found = schedule.getEvents().find(e => e.id === event.id);
      if (found) {
        await new ScheduleService().removeEventFromSchedule(schedule.id, event.id);
        break;
      }
    }
    await fetchEvents();
  } catch (e) {
    error.value = 'イベント削除に失敗しました';
  }
  loading.value = false;
}

/**
 * 新しいイベントを追加します。
 */
async function addEvent() {
  loading.value = true;
  error.value = '';
  try {
    const iEvent: any = {
      id: newEvent.value.id || crypto.randomUUID(),
      getEventName: () => newEvent.value.name,
      changeEventName: (name: string) => { newEvent.value.name = name; },
      getTimeSpan: () => ({ start: '', end: '' }),
      updateTimeSpan: () => { },
      getDetail: () => ({ assetName: newEvent.value.assetName }),
      clone: () => iEvent,
      execute: () => { }
    };
    const schedules = await new ScheduleService().getAllSchedules();
    if (schedules.length > 0) {
      await new ScheduleService().addEventToSchedule(schedules[0].id, iEvent);
      await fetchEvents();
      showAddDialog.value = false;
      newEvent.value = { id: '', name: '', type: 'AudioEvent', assetName: '' };
    } else {
      error.value = '追加先スケジュールがありません';
    }
  } catch (e) {
    error.value = 'イベント追加に失敗しました';
  }
  loading.value = false;
}

/**
 * 編集ダイアログを閉じます。
 */
function closeEditDialog() {
  showEditDialog.value = false;
  selectedEvent.value = null;
}

onMounted(() => {
  fetchAssetOptions();
  fetchEvents();
});
</script>

<style scoped>
.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.dialog {
  background-color: white;
  padding: 2em;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  color: #333;
}

.controls {
  margin-bottom: 1em;
}

.error-message {
  color: #dc2626;
  font-weight: bold;
}

.loading-message {
  color: #1d4ed8;
  font-style: italic;
}
</style>
