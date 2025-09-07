<template>
  <div class="event-editor">
    <h2>イベント一覧 / 編集</h2>

    <div class="controls">
      <button @click="openNew">新規追加</button>
      <button @click="loadEvents">更新</button>
    </div>

    <table class="event-table">
      <thead>
        <tr>
          <th>タイトル</th>
          <th>開始</th>
          <th>終了</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ev in events" :key="ev.scheduleEventId">
          <td>{{ ev.scheduleEventName }}</td>
          <td>{{ ev.scheduleTimeSpan?.start }}</td>
          <td>{{ ev.scheduleTimeSpan?.end }}</td>
          <td>
            <button @click="startEdit(ev)">編集</button>
            <button @click="remove(ev.scheduleEventId)">削除</button>
          </td>
        </tr>
        <tr v-if="events.length === 0">
          <td colspan="4">イベントがありません</td>
        </tr>
      </tbody>
    </table>

    <div v-if="editing" class="editor-form">
      <h3>{{ isNew ? '新規イベント作成' : 'イベント編集' }}</h3>
      <form @submit.prevent="save">
        <div>
          <label>タイトル</label>
          <input v-model="form.eventName" required />
        </div>
        <div>
          <label>説明</label>
          <input v-model="form.eventDetail" />
        </div>
        <div>
          <label>開始 (ISO)</label>
          <input v-model="form.timeSpan.start" type="datetime-local" />
        </div>
        <div>
          <label>終了 (ISO)</label>
          <input v-model="form.timeSpan.end" type="datetime-local" />
        </div>
        <div class="form-actions">
          <button type="submit">{{ isNew ? '追加' : '保存' }}</button>
          <button type="button" @click="cancel">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ScheduleEventService } from '../../../model/applications/schedule/schedule-event-service';
import type { IScheduleEvent } from '../../../model/domains/schedule-event/entity/schedule-event';
import { PlayAudioEventType } from '../../../model/domains/schedule-event/vo/event-types/events/play-audio-event-type';
import { ScheduleTimeSpan } from '../../../model/domains/schedule-event/vo/schedule-timespan';
import { ref, reactive, onMounted } from 'vue';

const events = ref<IScheduleEvent[]>([]);
const editing = ref(false);
const isNew = ref(true);
const form = reactive({
  eventId: '',
  eventName: '',
  eventDetail: '',
  timeSpan: ScheduleTimeSpan.Empty,
});

async function loadEvents() {
  try {
    const list = await new ScheduleEventService().getAllScheduleEvents();
    events.value = list ?? [];
  } catch (err) {
    console.error('イベント取得に失敗しました', err);
  }
}

function openNew() {
  isNew.value = true;
  editing.value = true;
  form.eventId = crypto.randomUUID();
  form.eventName = '';
  form.eventDetail = '';
  form.timeSpan = ScheduleTimeSpan.Empty;
}

function startEdit(scheduleEvent: IScheduleEvent) {
  isNew.value = false;
  editing.value = true;
  form.eventId = scheduleEvent.scheduleEventId;
  form.eventName = scheduleEvent.scheduleEventName;
  form.eventDetail = scheduleEvent.scheduleEventDetail;
  form.timeSpan = scheduleEvent.scheduleTimeSpan;
}

async function save() {
  try {
    // const payload = {
    //   eventId: form.eventId,
    //   eventName: form.eventName,
    //   eventDetail: form.eventDetail,
    //   timeSpan: form.timeSpan
    // };

    if (isNew.value) {
      // Service に合わせてメソッド名を調整してください (例: add)
      await new ScheduleEventService().createNewScheduleEvent(new PlayAudioEventType(), "新規イベント（音楽再生）");
    } else {
      // Service に合わせてメソッド名を調整してください (例: update)
      // await new ScheduleEventService().(payload);
    }

    editing.value = false;
    await loadEvents();
  } catch (err) {
    console.error('保存に失敗しました', err);
  }
}

async function remove(id?: string) {
  if (!id) return;
  if (!confirm('本当に削除しますか？')) return;
  try {
    // Service に合わせてメソッド名を調整してください (例: delete)
    await new ScheduleEventService().deleteScheduleEvent(id);
    await loadEvents();
  } catch (err) {
    console.error('削除に失敗しました', err);
  }
}

function cancel() {
  editing.value = false;
}

onMounted(() => {
  loadEvents();
});
</script>

<style scoped>
.event-editor {
  padding: 16px;
}

.controls {
  margin-bottom: 12px;
}

.event-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 12px;
}

.event-table th,
.event-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.editor-form {
  border: 1px solid #eee;
  padding: 12px;
  background: #fafafa;
}

.form-actions {
  margin-top: 8px;
}
</style>