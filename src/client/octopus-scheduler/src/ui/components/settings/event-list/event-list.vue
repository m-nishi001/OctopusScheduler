<template>
    <div class="event-list-editor">
        <div class="editor-content">
            <h2 class="editor-title">
                <span class="editor-icon">📅</span> スケジュールイベント管理
            </h2>
            <div class="controls">
                <button class="main-btn" @click="onAdd" :disabled="loading">
                    <span class="btn-icon">➕</span> 追加
                </button>
                <button class="main-btn" @click="onReload" :disabled="loading">
                    <span class="btn-icon">🔄</span> 再読込
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
                            <td>{{ ev.type }}</td>
                            <td>{{ getTypeLabel(ev.type) }}</td>
                            <td>{{ formatDate(ev.startTime) }}</td>
                            <td>{{ formatDate(ev.endTime) }}</td>
                            <td>
                                <button class="main-btn small" @click="onEdit(ev)" :disabled="loading"><span
                                        class="btn-icon">✏️</span>
                                    編集</button>
                                <button class="main-btn small delete-btn" @click="onDelete(ev)"
                                    :disabled="loading"><span class="btn-icon">🗑️</span>
                                    削除</button>
                            </td>
                        </tr>
                        <tr v-if="events.length === 0">
                            <td colspan="6">イベントがありません。</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <EventTypeSelectionDialog v-if="showTypeSelection" @select="onTypeSelected"
            @close="showTypeSelection = false" />
        <ContentDisplayEventDialog v-if="showContentDialog" :event="editingEvent as any" @submit="onContentSubmit"
            @close="closeDialogs" />
        <MusicPlaybackEventDialog v-if="showMusicDialog" :event="editingEvent as any" @submit="onMusicSubmit"
            @close="closeDialogs" />
        <ScreenTransitionEventDialog v-if="showTransitionDialog" :event="editingEvent as any"
            @submit="onTransitionSubmit" @close="closeDialogs" />
        <SlideshowEventDialog v-if="showSlideshowDialog" :event="editingEvent as any" @submit="onSlideshowSubmit"
            @close="closeDialogs" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../../../model/applications/schedule-event/schedule-event-service';
import type { IScheduleEventDto } from '../../../../model/applications/schedule-event/i-schedule-event-dto';
import EventTypeSelectionDialog from './dialogs/event-type-selection-dialog.vue';
import ContentDisplayEventDialog from './dialogs/content-display-event-dialog.vue';
import MusicPlaybackEventDialog from './dialogs/music-playback-event-dialog.vue';
import ScreenTransitionEventDialog from './dialogs/screen-transition-event-dialog.vue';
import SlideshowEventDialog from './dialogs/slideshow-event-dialog.vue';
import { ShowContentEventDto } from '../../../../model/applications/schedule-event/show-content-event/show-content-event-dto';
import { PlayAudioEventDto } from '../../../../model/applications/schedule-event/play-audio-event/play-audio-event-dto';
import { TransitionPageEventDto } from '../../../../model/applications/schedule-event/transition-page-event/transition-page-event-dto';
import { SlideshowEventDto } from '../../../../model/applications/schedule-event/slideshow-event/slideshow-event-dto';

const events = ref<IScheduleEventDto[]>([]);
const loading = ref(false);
const selectedEvents = ref<string[]>([]);
const syncing = ref(false);
const deleting = ref(false);
const showTypeSelection = ref(false);
const showContentDialog = ref(false);
const showMusicDialog = ref(false);
const showTransitionDialog = ref(false);
const showSlideshowDialog = ref(false);
const editingEvent = ref<IScheduleEventDto | null>(null);

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

function getTypeLabel(type: string): string {
    switch (type) {
        case 'ShowContentEvent': return 'コンテンツ表示';
        case 'PlayAudioEvent': return '音楽再生';
        case 'TransitionPageEvent': return '画面遷移';
        case 'SlideshowEvent': return 'スライドショー';
        default: return type;
    }
}

function formatDate(d: any) {
    try {
        const date = new Date(d);
        return isNaN(date.getTime()) ? '' : date.toLocaleString();
    } catch {
        return '';
    }
}

async function getAllScheduleEvents() {
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

function onAdd() {
    editingEvent.value = null;
    showTypeSelection.value = true;
}

function onTypeSelected(type: string) {
    showTypeSelection.value = false;
    switch (type) {
        case 'ShowContentEvent':
            showContentDialog.value = true;
            break;
        case 'PlayAudioEvent':
            showMusicDialog.value = true;
            break;
        case 'TransitionPageEvent':
            showTransitionDialog.value = true;
            break;
        case 'SlideshowEvent':
            showSlideshowDialog.value = true;
            break;
    }
}

function onEdit(ev: IScheduleEventDto) {
    editingEvent.value = ev;
    switch (ev.type) {
        case 'ShowContentEvent':
            showContentDialog.value = true;
            break;
        case 'PlayAudioEvent':
            showMusicDialog.value = true;
            break;
        case 'TransitionPageEvent':
            showTransitionDialog.value = true;
            break;
        case 'SlideshowEvent':
            showSlideshowDialog.value = true;
            break;
    }
}

function closeDialogs() {
    showContentDialog.value = false;
    showMusicDialog.value = false;
    showTransitionDialog.value = false;
    showSlideshowDialog.value = false;
    editingEvent.value = null;
}

async function onContentSubmit(form: any) {
    try {
        if (editingEvent.value) {
            // Update
            const updated = new ShowContentEventDto(
                editingEvent.value.id,
                form.startTime,
                form.endTime,
                form.contentType,
                form.contentId,
                form.htmlString,
                form.fadeOutDuration,
                editingEvent.value.processedAt,
                editingEvent.value.registeredAt,
                new Date()
            );
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            // Add
            const tempEvent = new ShowContentEventDto(
                '',
                form.startTime,
                form.endTime,
                form.contentType,
                form.contentId,
                form.htmlString,
                form.fadeOutDuration,
                null,
                new Date(),
                new Date()
            );
            const id = await scheduleEventService.addScheduleEvents([tempEvent]);
            const newEvent = new ShowContentEventDto(
                id,
                form.startTime,
                form.endTime,
                form.contentType,
                form.contentId,
                form.htmlString,
                form.fadeOutDuration,
                null,
                new Date(),
                new Date()
            );
            events.value.push(newEvent);
        }
        if (editingEvent.value) {
            await getAllScheduleEvents();
        }
        closeDialogs();
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

async function onMusicSubmit(form: any) {
    try {
        if (editingEvent.value) {
            // Update
            const updated = new PlayAudioEventDto(
                editingEvent.value.id,
                form.startTime,
                form.endTime,
                form.audioId,
                form.fadeOutDuration,
                editingEvent.value.processedAt,
                editingEvent.value.registeredAt,
                new Date()
            );
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            // Add
            const tempEvent = new PlayAudioEventDto(
                '',
                form.startTime,
                form.endTime,
                form.audioId,
                form.fadeOutDuration,
                null,
                new Date(),
                new Date()
            );
            const id = await scheduleEventService.addScheduleEvents([tempEvent]);
            const newEvent = new PlayAudioEventDto(
                id,
                form.startTime,
                form.endTime,
                form.audioId,
                form.fadeOutDuration,
                null,
                new Date(),
                new Date()
            );
            events.value.push(newEvent);
        }
        if (editingEvent.value) {
            await getAllScheduleEvents();
        }
        closeDialogs();
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

async function onTransitionSubmit(form: any) {
    try {
        if (editingEvent.value) {
            // Update
            const updated = new TransitionPageEventDto(
                editingEvent.value.id,
                form.startTime,
                form.endTime,
                form.transitionUrl,
                form.fadeOutDuration,
                editingEvent.value.processedAt,
                editingEvent.value.registeredAt,
                new Date()
            );
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            // Add
            const tempEvent = new TransitionPageEventDto(
                '',
                form.startTime,
                form.endTime,
                form.transitionUrl,
                form.fadeOutDuration,
                null,
                new Date(),
                new Date()
            );
            const id = await scheduleEventService.addScheduleEvents([tempEvent]);
            const newEvent = new TransitionPageEventDto(
                id,
                form.startTime,
                form.endTime,
                form.transitionUrl,
                form.fadeOutDuration,
                null,
                new Date(),
                new Date()
            );
            events.value.push(newEvent);
        }
        if (editingEvent.value) {
            await getAllScheduleEvents();
        }
        closeDialogs();
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

async function onSlideshowSubmit(form: any) {
    try {
        if (editingEvent.value) {
            // Update
            const updated = new SlideshowEventDto(
                editingEvent.value.id,
                form.startTime,
                form.endTime,
                form.folderId,
                form.displayDuration,
                form.transitionType,
                form.slideDirection,
                form.bgmIds,
                editingEvent.value.processedAt,
                editingEvent.value.registeredAt,
                new Date()
            );
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            // Add
            const tempEvent = new SlideshowEventDto(
                '',
                form.startTime,
                form.endTime,
                form.folderId,
                form.displayDuration,
                form.transitionType,
                form.slideDirection,
                form.bgmIds,
                null,
                new Date(),
                new Date()
            );
            const id = await scheduleEventService.addScheduleEvents([tempEvent]);
            const newEvent = new SlideshowEventDto(
                id,
                form.startTime,
                form.endTime,
                form.folderId,
                form.displayDuration,
                form.transitionType,
                form.slideDirection,
                form.bgmIds,
                null,
                new Date(),
                new Date()
            );
            events.value.push(newEvent);
        }
        if (editingEvent.value) {
            await getAllScheduleEvents();
        }
        closeDialogs();
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

async function onReload() {
    syncing.value = true;
    try {
        await scheduleEventService.syncScheduleEvents();
        await getAllScheduleEvents();
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
        await getAllScheduleEvents();
    } catch (e) {
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        deleting.value = false;
    }
}

async function onDelete(ev: IScheduleEventDto) {
    if (!confirm(`${ev.type} を削除しますか？`)) return;
    try {
        await scheduleEventService.deleteScheduleEvents([ev.id]);
        await getAllScheduleEvents();
    } catch (e) {
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

onMounted(async () => {
    await scheduleEventService.syncScheduleEvents();
    getAllScheduleEvents();
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