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

type EventType = 'AudioEvent' | 'ImageEvent' | 'VideoEvent' | 'TransitionEvent';
type Event = { id: string; name: string; type: EventType; assetName?: string };

const events = ref<Event[]>([
  { id: 'e1', name: 'BGM再生', type: 'AudioEvent', assetName: 'BGM1' },
  { id: 'e2', name: '画像表示', type: 'ImageEvent', assetName: '画像1' }
]);

const showAddDialog = ref(false);
const newEvent = ref<Event>({ id: '', name: '', type: 'AudioEvent', assetName: '' });

const { getAll } = useLocalStorage();
const assetOptions = ref<Record<EventType, string[]>>({
  AudioEvent: [],
  ImageEvent: [],
  VideoEvent: [],
  TransitionEvent: []
});

async function fetchAssetOptions() {
  const audioAssets = Array.from((await getAll<{ id: string; name: string }>() ).values()).map(a => a.name);
  assetOptions.value.AudioEvent = audioAssets;
  assetOptions.value.VideoEvent = audioAssets;
  const imageAssets = Array.from((await getAll<{ id: string; name: string }>() ).values()).map(a => a.name);
  assetOptions.value.ImageEvent = imageAssets;
}

onMounted(() => {
  fetchAssetOptions();
});

function onEdit(event: Event) {
  alert(`イベント編集: ${event.name}`);
}
function onDelete(event: Event) {
  if (!window.confirm(`${event.name} を削除しますか？`)) return;
  events.value = events.value.filter(e => e.id !== event.id);
}
function addEvent() {
  events.value.push({ ...newEvent.value, id: `ev_${Date.now()}` });
  showAddDialog.value = false;
  newEvent.value = { id: '', name: '', type: 'AudioEvent', assetName: '' };
}
</script>

<style scoped>
table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1em;
}
th, td {
  border: 1px solid #ccc;
  padding: 0.5em;
}
button {
  margin-right: 0.5em;
}
.dialog-backdrop {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.2);
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
