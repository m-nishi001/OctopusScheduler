<template>
    <div class="event-list-editor">
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
                <button class="main-btn" @click="onSync" :disabled="syncing">
                    <span class="btn-icon">🔄</span> 同期
                </button>
                <button class="main-btn delete-btn" @click="onDeleteSelected"
                    :disabled="!selectedEvents.length || deleting">
                    <span class="btn-icon">🗑️</span> 選択削除
                </button>
            </div>
            <div v-if="events.length" class="list-controls">
                <label class="select-all-label">
                    <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
                    <span class="sr-only">全選択</span>
                </label>
            </div>
            <div class="table-section">
                <table class="event-table">
                    <thead>
                        <tr>
                            <th>選択</th>
                            <th>イベント名</th>
                            <th>種別</th>
                            <th>開始</th>
                            <th>終了</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="ev in events" :key="ev.id">
                            <td><input type="checkbox" v-model="selectedEvents" :value="ev.id" /></td>
                            <td>{{ ev.name }}</td>
                            <td>{{ ev.type }}</td>
                            <td>{{ formatDate(ev.timeSpan.start) }}</td>
                            <td>{{ formatDate(ev.timeSpan.end) }}</td>
                            <td>
                                <button class="main-btn small" @click="onEdit(ev)" :disabled="loading"><span
                                        class="btn-icon">✏️</span>
                                    編集</button>
                                <button class="main-btn small" @click="onDelete(ev)" :disabled="loading"><span
                                        class="btn-icon">🗑️</span>
                                    削除</button>
                            </td>
                        </tr>
                        <tr v-if="events.length === 0">
                            <td colspan="6">イベントがありません。</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div v-if="editing && form" class="modal-overlay" @click="onCancel">
                <div class="modal-content" @click.stop>
                    <h3>{{ isNew ? '新規イベント追加' : 'イベント編集' }}</h3>
                    <form @submit.prevent="isNew ? onAdd() : onUpdate()">
                        <label>
                            イベント名:
                            <input v-model="form.name" required />
                        </label>
                        <label>
                            種別:
                            <select v-model="form.type" @change="onEventTypeChange">
                                <option v-for="type in eventTypes" :key="type.eventType" :value="type.eventType">
                                    {{ type.displayName }}
                                </option>
                            </select>
                        </label>
                        <label>
                            開始:
                            <input v-model="form.timeSpan.start" type="datetime-local" required />
                        </label>
                        <label>
                            終了:
                            <input v-model="form.timeSpan.end" type="datetime-local" required />
                        </label>
                        <!-- 各イベントタイプの設定コンポーネント -->
                        <PlayAudioEventConfig v-if="form.type === 'PlayAudioEvent' && form.detail"
                            :model-value="form.detail"
                            @update:modelValue="(val: any) => { if (form) form.detail = val; }" />
                        <PlayMovieEventConfig v-if="form.type === 'PlayMovieEvent' && form.detail"
                            :model-value="form.detail"
                            @update:modelValue="(val: any) => { if (form) form.detail = val; }" />
                        <ShowImageEventConfig v-if="form.type === 'ShowImageEvent' && form.detail"
                            :model-value="form.detail"
                            @update:modelValue="(val: any) => { if (form) form.detail = val; }" />
                        <TransitionPageEventConfig v-if="form.type === 'TransitionPageEvent' && form.detail"
                            :model-value="form.detail"
                            @update:modelValue="(val: any) => { if (form) form.detail = val; }" />
                        <div class="form-actions">
                            <button class="main-btn" type="submit" :disabled="saving">{{ isNew ? '追加' : '保存' }}</button>
                            <button class="main-btn" type="button" @click="onCancel">キャンセル</button>
                        </div>
                    </form>
                </div>
            </div>

            <!-- イベント種別選択モーダル -->
            <div v-if="showEventTypeModal" class="modal-overlay" @click="closeEventTypeModal">
                <div class="modal-content" @click.stop>
                    <h3>追加するイベント種別を選択</h3>
                    <div class="event-type-list">
                        <button v-for="type in eventTypes" :key="type.eventType" class="event-type-btn"
                            @click="selectEventType(type.eventType)">
                            {{ type.displayName }}
                        </button>
                    </div>
                    <div class="form-actions">
                        <button class="main-btn" type="button" @click="closeEventTypeModal">キャンセル</button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../../../model/applications/schedule-event/schedule-event-service';
import type { ScheduleEventDto } from '../../../../model/domains/schedule-event/entity/schedule-event';
import PlayAudioEventConfig from './play-audio-event/play-audio-event-config.vue';
import PlayMovieEventConfig from './play-movie-event/play-movie-event-config.vue';
import ShowImageEventConfig from './show-image-event/show-image-event-config.vue';
import TransitionPageEventConfig from './transition-page-event/transition-page-event-config.vue';

const events = ref<ScheduleEventDto[]>([]);
const loading = ref(false);
const saving = ref(false);
const editing = ref(false);
const isNew = ref(true);
const eventTypes = ref<any[]>([]);
const selectedEvents = ref<string[]>([]);
const syncing = ref(false);
const deleting = ref(false);
const showEventTypeModal = ref(false);

const form = ref<any>(null);

const scheduleEventService = container.resolve(ScheduleEventService);

const isAllSelected = computed({
    get: () => {
        return events.value.length > 0 && selectedEvents.value.length === events.value.length;
    },
    set: (val: boolean) => {
        if (val) {
            selectedEvents.value = events.value.map(ev => ev.id);
        } else {
            selectedEvents.value = [];
        }
    }
});

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
        const list = await scheduleEventService.getScheduleEvents();
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

async function onSync() {
    syncing.value = true;
    try {
        await fetchEvents();
    } catch (e) {
        alert('同期に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        syncing.value = false;
    }
}

async function onDeleteSelected() {
    if (!selectedEvents.value.length) return;
    if (!confirm(`${selectedEvents.value.length} 件のイベントを削除しますか？`)) return;
    deleting.value = true;
    try {
        await scheduleEventService.deleteScheduleEvents(selectedEvents.value);
        selectedEvents.value = [];
        await fetchEvents();
    } catch (e) {
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        deleting.value = false;
    }
}

function getDefaultDetail(eventType: string) {
    switch (eventType) {
        case 'PlayAudioEvent':
            return { audioId: '' };
        case 'PlayMovieEvent':
            return { movieId: '' };
        case 'ShowImageEvent':
            return { imageId: '' };
        case 'TransitionPageEvent':
            return { transitionUrl: '' };
        default:
            return {};
    }
}


function onNew() {
    showEventTypeModal.value = true;
}

function closeEventTypeModal() {
    showEventTypeModal.value = false;
}

function selectEventType(eventType: string) {
    showEventTypeModal.value = false;
    isNew.value = true;
    editing.value = true;
    form.value = {
        id: '',
        name: '',
        type: eventType,
        timeSpan: { start: '', end: '' },
        detail: getDefaultDetail(eventType),
        processedAt: null,
        registeredAt: new Date(),
        updatedAt: new Date()
    };
}

function onEdit(ev: ScheduleEventDto) {
    isNew.value = false;
    editing.value = true;
    form.value = {
        id: ev.id,
        name: ev.name,
        type: ev.type,
        timeSpan: { start: ev.timeSpan.start.toISOString().slice(0, 16), end: ev.timeSpan.end.toISOString().slice(0, 16) },
        detail: ev.detail,
        processedAt: ev.processedAt,
        registeredAt: ev.registeredAt,
        updatedAt: ev.updatedAt
    };
}

function onEventTypeChange() {
    if (!form.value) return;
    // 新規作成時のみリセット、編集時は既存detailを保持
    if (isNew.value) {
        form.value.detail = getDefaultDetail(form.value.type);
    }
}

async function onAdd() {
    if (!form.value) return;
    if (!form.value.name || !form.value.timeSpan.start || !form.value.timeSpan.end || !form.value.type) {
        alert('必須項目を入力してください');
        return;
    }
    saving.value = true;
    try {
        const dto: ScheduleEventDto = {
            id: crypto.randomUUID(),
            type: form.value.type,
            name: form.value.name,
            timeSpan: {
                start: new Date(form.value.timeSpan.start),
                end: new Date(form.value.timeSpan.end),
                equals: () => false // dummy
            },
            detail: form.value.detail,
            processedAt: null,
            registeredAt: new Date(),
            updatedAt: new Date()
        };
        await scheduleEventService.addScheduleEvents([dto]);
        editing.value = false;
        form.value = null;
        await fetchEvents();
    } catch (e) {
        alert('追加に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        saving.value = false;
    }
}

async function onUpdate() {
    if (!form.value) return;
    if (!form.value.name || !form.value.timeSpan.start || !form.value.timeSpan.end || !form.value.type) {
        alert('必須項目を入力してください');
        return;
    }
    saving.value = true;
    try {
        const dto: ScheduleEventDto = {
            id: form.value.id,
            type: form.value.type,
            name: form.value.name,
            timeSpan: {
                start: new Date(form.value.timeSpan.start),
                end: new Date(form.value.timeSpan.end),
                equals: () => false // dummy
            },
            detail: form.value.detail,
            processedAt: form.value.processedAt,
            registeredAt: form.value.registeredAt,
            updatedAt: new Date()
        };
        await scheduleEventService.updateScheduleEvents([dto]);
        editing.value = false;
        form.value = null;
        await fetchEvents();
    } catch (e) {
        alert('更新に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        saving.value = false;
    }
}

async function onDelete(ev: ScheduleEventDto) {
    if (!confirm(`${ev.name} を削除しますか？`)) return;
    try {
        await scheduleEventService.deleteScheduleEvents([ev.id]);
        await fetchEvents();
    } catch (e) {
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

function onCancel() {
    editing.value = false;
    form.value = null;
}

onMounted(async () => {
    eventTypes.value = [
        { eventType: 'PlayAudioEvent', displayName: '音声再生' },
        { eventType: 'PlayMovieEvent', displayName: '動画再生' },
        { eventType: 'ShowImageEvent', displayName: '画像表示' },
        { eventType: 'TransitionPageEvent', displayName: 'ページ遷移' }
    ];
    fetchEvents();
});
</script>

<style scoped>
.event-list-editor {
    color: #fff;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.editor-content {
    width: 100%;
    height: 100%;
    padding: 2em;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.nav-group {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 1em;
}

.nav-btn {
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    font-size: 1em;
    font-weight: 600;
    padding: 0.7em 1.8em;
    margin-right: 1em;
    display: flex;
    align-items: center;
    gap: 0.7em;
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

.main-btn.small {
    font-size: 0.95em;
    padding: 0.5em 1.2em;
    margin-right: 0.5em;
}

.main-btn:disabled {
    background: #444 !important;
    color: #aaa !important;
    cursor: not-allowed !important;
    box-shadow: none !important;
    opacity: 0.6;
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
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
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
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
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

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #232323;
    color: #fff;
    padding: 2em;
    border-radius: 10px;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
}

.modal-content h3 {
    margin-bottom: 1em;
    color: #8fd3ff;
}

.event-type-list {
    display: flex;
    flex-direction: column;
    gap: 1em;
    margin-bottom: 1em;
}

.event-type-btn {
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    border: none;
    border-radius: 10px;
    padding: 1em;
    cursor: pointer;
    font-size: 1.1em;
    font-weight: 600;
    transition: box-shadow 0.18s, transform 0.12s;
}

.event-type-btn:hover {
    box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
    transform: translateY(-2px);
}

.list-controls {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}

.select-all-label {
    margin-left: 10px;
}

.select-all-checkbox {
    width: 20px;
    height: 20px;
    margin: 0;
    vertical-align: middle;
}

.sr-only {
    position: absolute !important;
    height: 1px;
    width: 1px;
    overflow: hidden;
    clip: rect(1px, 1px, 1px, 1px);
    white-space: nowrap;
    border: 0;
    padding: 0;
    margin: -1px;
}

.delete-btn {
    background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
    box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
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