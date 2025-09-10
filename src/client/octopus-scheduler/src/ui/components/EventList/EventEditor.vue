<template>
  <div class="event-list-editor">
    <h2>スケジュールイベント管理</h2>
    <div class="controls">
      <button @click="onReload" :disabled="loading">再読込</button>
      <button @click="onNew">新規追加</button>
    </div>
    <table class="event-table">
      <thead>
        <tr>
          <th>イベント名</th>
          <th>種別</th>
          <th>開始</th>
          <th>終了</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="ev in events" :key="ev.scheduleEventId">
          <td>{{ ev.scheduleEventName }}</td>
          <td>{{ ev.scheduleEventType.displayName }}</td>
          <td>{{ formatDate(ev.scheduleTimeSpan?.start) }}</td>
          <td>{{ formatDate(ev.scheduleTimeSpan?.end) }}</td>
          <td>
            <button @click="onEdit(ev)">編集</button>
            <button @click="onDelete(ev)">削除</button>
          </td>
        </tr>
        <tr v-if="events.length === 0">
          <td colspan="5">イベントがありません。</td>
        </tr>
      </tbody>
    </table>
    <div v-if="editing" class="editor-form">
      <h3>{{ isNew ? '新規イベント追加' : 'イベント編集' }}</h3>
      <form @submit.prevent="onSave">
        <label>
          イベント名:
          <input v-model="form.eventName" required />
        </label>
        <label>
          種別:
          <select v-model="form.eventType">
            <option v-for="type in eventTypes" :key="type.scheduleEventType" :value="type">
              {{ type.displayName }}
            </option>
          </select>
        </label>
        <label>
          開始:
          <input v-model="form.start" type="datetime-local" required />
        </label>
        <label>
          終了:
          <input v-model="form.end" type="datetime-local" required />
        </label>
        <div class="form-actions">
          <button type="submit" :disabled="saving">{{ isNew ? '追加' : '保存' }}</button>
          <button type="button" @click="onCancel">キャンセル</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../../model/applications/schedule/schedule-event-service';
import type { IScheduleEvent } from '../../../model/domains/schedule-event/entity/schedule-event';
import { PlayAudioEventType } from '../../../model/domains/schedule-event/vo/event-types/events/play-audio-event-type';
import { PlayMovieEventType } from '../../../model/domains/schedule-event/vo/event-types/events/play-movie-event-type';
import { ShowImageEventType } from '../../../model/domains/schedule-event/vo/event-types/events/show-image-event-type';
import { TransitionPageEventType } from '../../../model/domains/schedule-event/vo/event-types/events/transition-page-event';
import { ScheduleTimeSpan } from '../../../model/domains/schedule-event/vo/schedule-timespan';

const events = ref<IScheduleEvent[]>([]);
const loading = ref(false);
const saving = ref(false);
const editing = ref(false);
const isNew = ref(true);

const eventTypes = [
  new PlayAudioEventType(),
  new PlayMovieEventType(),
  new ShowImageEventType(),
  new TransitionPageEventType()
];

const form = reactive({
  eventId: '',
  eventName: '',
  eventType: eventTypes[0],
  start: '',
  end: ''
});

const scheduleEventService = container.resolve(ScheduleEventService);

function formatDate(d: any) {
  try {
    const date = new Date(d);
    return isNaN(date.getTime()) ? '' : date.toLocaleString();
  } catch {
    return '';
  }
}

async function fetchEvents() {
  loading.value = true;
  try {
    const list = await scheduleEventService.getAllScheduleEvents();
    events.value = list ?? [];
  } catch (e) {
    alert('イベント取得に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
  } finally {
    loading.value = false;
  }
}

function onReload() {
  fetchEvents();
}

function onNew() {
  isNew.value = true;
  editing.value = true;
  form.eventId = '';
  form.eventName = '';
  form.eventType = eventTypes[0];
  form.start = '';
  form.end = '';
}

function onEdit(ev: IScheduleEvent) {
  isNew.value = false;
  editing.value = true;
  form.eventId = ev.scheduleEventId;
  form.eventName = ev.scheduleEventName;
  form.eventType = eventTypes.find(t => t.scheduleEventType === ev.scheduleEventType.scheduleEventType) || eventTypes[0];
  form.start = ev.scheduleTimeSpan?.start ? new Date(ev.scheduleTimeSpan.start).toISOString().slice(0, 16) : '';
  form.end = ev.scheduleTimeSpan?.end ? new Date(ev.scheduleTimeSpan.end).toISOString().slice(0, 16) : '';
}

async function onSave() {
  if (!form.eventName || !form.start || !form.end) {
    alert('必須項目を入力してください');
    return;
  }
  saving.value = true;
  try {
    const startDate = new Date(form.start);
    const endDate = new Date(form.end);
    const timeSpan = ScheduleTimeSpan.create(startDate, endDate);
    if (!timeSpan) throw new Error('開始日時と終了日時が不正です');

    if (isNew.value) {
      // 新規作成
      await scheduleEventService.createNewScheduleEvent(form.eventType, form.eventName);
      // 更新系は未実装のため、編集は不可
    } else {
      alert('編集（update）は未実装です。');
    }
    editing.value = false;
    await fetchEvents();
  } catch (e) {
    alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
  } finally {
    saving.value = false;
  }
}

async function onDelete(ev: IScheduleEvent) {
  if (!confirm(`${ev.scheduleEventName} を削除しますか？`)) return;
  try {
    await scheduleEventService.deleteScheduleEvent(ev.scheduleEventId);
    await fetchEvents();
  } catch (e) {
    alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
  }
}

function onCancel() {
  editing.value = false;
}

onMounted(() => {
  fetchEvents();
});
</script>

<style scoped>
/* ...existing code... */
.event-list-editor {
  padding: 16px;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.event-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
}

.event-table th,
.event-table td {
  border: 1px solid #ddd;
  padding: 0.5rem;
}

.editor-form {
  border: 1px solid #444;
  padding: 12px;
  background: #222;
  margin-top: 1rem;
  color: #fff;
}

.editor-form input,
.editor-form select {
  background: #333;
  color: #fff;
  border: 1px solid #666;
  padding: 0.3em 0.6em;
  margin-bottom: 0.5em;
}

.editor-form label {
  display: flex;
  align-items: center;
  gap: 0.5em;
  margin-bottom: 0.7em;
}

.form-actions {
  margin-top: 8px;
  display: flex;
  gap: 1rem;
}
</style>