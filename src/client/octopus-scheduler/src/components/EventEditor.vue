<template>
  <div>
    <h2>イベント編集画面</h2>
    <button @click="showAddDialog = true">イベント追加</button>
    <table>
      <thead>
        <tr>
          <th>名前</th>
          <th>種別</th>
          <th>アセット</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="event in events" :key="event.id">
          <td>{{ event.name }}</td>
          <td>{{ event.type }}</td>
          <td>{{ event.assetName }}</td>
          <td>
            <button @click="onEdit(event)">編集</button>
            <button @click="onDelete(event)">削除</button>
          </td>
        </tr>
      </tbody>
    </table>
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
import { useLocalStorage } from '../../../packages/shared-composables/src/use-localstorage';
import { ScheduleService } from '../applications/schedule/schedule-service';

type EventType = 'AudioEvent' | 'ImageEvent' | 'VideoEvent' | 'TransitionEvent';
type Event = { id: string; name: string; type: EventType; assetName?: string };


const events = ref<Event[]>([]);
const showAddDialog = ref(false);
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

async function fetchAssetOptions() {
  const audioAssets = Array.from((await getAll<{ id: string; name: string }>()).values()).map(a => a.name);
  assetOptions.value.AudioEvent = audioAssets;
  assetOptions.value.VideoEvent = audioAssets;
  const imageAssets = Array.from((await getAll<{ id: string; name: string }>()).values()).map(a => a.name);
  assetOptions.value.ImageEvent = imageAssets;
}

async function fetchEvents() {
  loading.value = true;
  error.value = '';
  try {
    // 全イベント取得APIを利用
    console.log('[EventEditor] fetchEvents called');
    const schedules = await new ScheduleService().getAllSchedules();
    console.log('[EventEditor] schedules fetched:', JSON.stringify(schedules));
    // 全スケジュールのイベントを集約
    const allEvents: any[] = [];
    schedules.forEach(schedule => {
      const scheduleEvents = schedule.getEvents();
      allEvents.push(...scheduleEvents);
    });

    console.log('[EventEditor] allEvents fetched:', JSON.stringify(allEvents));

    // IEvent[] -> Event[] へ変換
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
    console.log('[EventEditor] events.value after fetch:', JSON.stringify(events.value));
  } catch (e) {
    error.value = 'イベント一覧の取得に失敗しました';
  }
  loading.value = false;
}

onMounted(() => {
  fetchAssetOptions();
  fetchEvents();
});

function onEdit(event: Event) {
  alert(`イベント編集: ${event.name}`);
}

async function onDelete(event: Event) {
  if (!window.confirm(`${event.name} を削除しますか？`)) return;
  loading.value = true;
  error.value = '';
  try {
    // 全スケジュールから該当イベントを削除
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

async function addEvent() {
  loading.value = true;
  error.value = '';
  try {
    // Event -> IEvent 変換（簡易モック: 必要なら本来のIEvent実装をimportしてnewする）
    const iEvent: any = {
      id: newEvent.value.id || crypto.randomUUID(),
      getEventName: () => newEvent.value.name,
      changeEventName: (name: string) => { newEvent.value.name = name; },
      getTimeSpan: () => ({ start: '', end: '' }), // 必要なら入力項目追加
      updateTimeSpan: () => { },
      getDetail: () => ({ assetName: newEvent.value.assetName }),
      clone: () => iEvent,
      execute: () => { }
    };
    // 追加先スケジュールは最初のもの（または選択UIを追加しても良い）
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
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1em;
}

th,
td {
  border: 1px solid #ccc;
  padding: 0.5em;
}

button {
  margin-right: 0.5em;
}

.dialog-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: #fff;
  padding: 2em;
  border-radius: 8px;
  min-width: 300px;
}
</style>
