<template>
  <div class="event-list-editor dark-bg">
    <div class="editor-content">
      <h2 class="editor-title">
        <span class="editor-icon">📅</span> スケジュールイベント管理
      </h2>
      <div class="controls">
        <button class="main-btn" @click="onReload" :disabled="loading">
          <span class="btn-icon">🔄</span> 再読込
        </button>
        <button class="main-btn" @click="onNew">
          <span class="btn-icon">➕</span> 新規追加
        </button>
      </div>
      <div class="table-section">
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
                <button class="main-btn small" @click="onEdit(ev)"><span class="btn-icon">✏️</span> 編集</button>
                <button class="main-btn small" @click="onDelete(ev)"><span class="btn-icon">🗑️</span> 削除</button>
              </td>
            </tr>
            <tr v-if="events.length === 0">
              <td colspan="5">イベントがありません。</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="editing && form" class="editor-form">
        <h3>{{ isNew ? '新規イベント追加' : 'イベント編集' }}</h3>
        <form @submit.prevent="onSave">
          <label>
            イベント名:
            <input v-model="form.eventName" required />
          </label>
          <label>
            種別:
            <select v-model="form.eventType">
              <option v-for="type in eventTypes" :key="type.eventType" :value="type.eventType">
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
            <button class="main-btn" type="submit" :disabled="saving">{{ isNew ? '追加' : '保存' }}</button>
            <button class="main-btn" type="button" @click="onCancel">キャンセル</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../../../model/applications/schedule-event/schedule-event-service';
import type { IScheduleEvent } from '../../../../model/domains/schedule-event/entity/schedule-event';
import type { CreateScheduleEventDto } from '../../../../model/applications/schedule-event/dtos/create-schedule-event-dto';
import type { EventTypeDto } from '../../../../model/applications/schedule-event/dtos/event-type-dto';

const events = ref<IScheduleEvent[]>([]);
const loading = ref(false);
const saving = ref(false);
const editing = ref(false);
const isNew = ref(true);
const eventTypes = ref<EventTypeDto[]>([]);

const form = ref<CreateScheduleEventDto | null>(null);

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
  form.value = {
    eventName: '',
    eventType: eventTypes.value[0]?.eventType ?? '',
    start: '',
    end: '',
    detail: undefined
  };
}

function onEdit(ev: IScheduleEvent) {
  isNew.value = false;
  editing.value = true;
  form.value = {
    eventName: ev.scheduleEventName,
    eventType: ev.scheduleEventType.scheduleEventType,
    start: ev.scheduleTimeSpan?.start ? new Date(ev.scheduleTimeSpan.start).toISOString().slice(0, 16) : '',
    end: ev.scheduleTimeSpan?.end ? new Date(ev.scheduleTimeSpan.end).toISOString().slice(0, 16) : '',
    detail: ev.scheduleEventDetail ?? undefined
  };
}

async function onSave() {
  if (!form.value?.eventName || !form.value?.start || !form.value?.end || !form.value?.eventType) {
    alert('必須項目を入力してください');
    return;
  }
  saving.value = true;
  try {
    if (isNew.value) {
      // 新規作成
      await scheduleEventService.createScheduleEvent(form.value);
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

.event-list-editor {
  background: linear-gradient(135deg, #181818 0%, #222 100%);
  color: #fff;
  min-height: 100vh;
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
}
.editor-content {
  width: 100vw;
  height: 100vh;
  padding: 2em;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  /* ベース層の背景・枠装飾を削除 */
}
.editor-title {
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
.editor-icon {
  font-size: 1.3em;
}
.controls {
  display: flex;
  gap: 1.2em;
  align-items: center;
  margin-bottom: 1.5em;
  width: 100%;
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
  box-shadow: 0 2px 12px rgba(0,0,0,0.25);
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
.main-btn:hover, .main-btn:focus {
  background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
  box-shadow: 0 4px 18px rgba(0,0,0,0.35);
  transform: translateY(-2px) scale(1.04);
}
.main-btn:active {
  background: #1a1a1a;
  transform: scale(0.98);
}
.main-btn.small {
  font-size: 0.95em;
  padding: 0.5em 1.2em;
  margin-right: 0.5em;
}
.table-section {
  width: 100%;
  margin-bottom: 1.5em;
}
.event-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 1rem;
  background: #232323;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
}
.event-table th,
.event-table td {
  border: 1px solid #444;
  padding: 0.7rem;
  color: #fff;
}
.event-table th {
  background: #222;
  font-weight: 600;
}
.event-table tr {
  transition: background 0.15s;
}
.event-table tr:hover {
  background: #2a2a2a;
}
.editor-form {
  border: 1px solid #444;
  padding: 1.2em 1em;
  background: #232323;
  margin-top: 1.5em;
  color: #fff;
  border-radius: 10px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.18);
  width: 100%;
}
.editor-form h3 {
  margin-bottom: 1em;
  color: #8fd3ff;
}
.editor-form input,
.editor-form select {
  background: #333;
  color: #fff;
  border: 1px solid #666;
  padding: 0.4em 0.8em;
  border-radius: 6px;
  margin-bottom: 0.7em;
}
.editor-form label {
  display: flex;
  align-items: center;
  gap: 0.7em;
  margin-bottom: 0.7em;
  color: #fff;
}
.form-actions {
  margin-top: 1em;
  display: flex;
  gap: 1.2em;
}
@media (max-width: 600px) {
  .editor-content {
    width: 100vw;
    height: 100vh;
    padding: 0.5em;
  }
  .editor-title {
    font-size: 1.2em;
  }
  .main-btn {
    font-size: 0.95em;
    padding: 0.7em 1.2em;
  }
  .event-table th,
  .event-table td {
    padding: 0.4em;
  }
  .editor-form {
    padding: 0.7em 0.3em;
  }
}
</style>