<template>
    <div class="admin-section event-list-editor">
        <!-- per-screen sync status removed; use 一括同期 (Bulk Sync) in header -->
        <!-- saving status handled inside dialogs -->
        <h2 class="editor-title">
            <span class="editor-icon">📅</span> イベント管理
        </h2>
        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="onAdd" :disabled="loading"
                title="追加">
                <span class="emoji">➕</span>
            </button>
            <!-- per-screen sync removed -->
            <button class="admin-btn icon-only" @click.prevent="onReload" :disabled="loading" title="再読込">🔄</button>
            <button class="admin-btn" @click.prevent="onExecute" :disabled="!selectedEvents.length || executing"
                title="実行">
                <span class="emoji">▶️</span>
            </button>
            <button class="admin-btn delete-btn" @click.prevent="onDeleteSelected"
                :disabled="!selectedEvents.length || deleting" title="選択削除">
                <span class="emoji">🗑️</span>
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
                            <button class="main-btn small delete-btn" @click="onDelete(ev)" :disabled="loading"><span
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

        <EventTypeSelectionDialog v-if="showTypeSelection" @select="onTypeSelected"
            @close="showTypeSelection = false" />
        <ContentDisplayEventDialog v-if="showContentDialog" :event="editingEvent as any" @saved="onDialogSaved"
            @close="closeDialogs" />
        <MusicPlaybackEventDialog v-if="showMusicDialog" :event="editingEvent as any" @saved="onDialogSaved"
            @close="closeDialogs" />
        <StopAudioEventDialog v-if="showStopAudioDialog" :event="editingEvent as any" @saved="onDialogSaved"
            @close="closeDialogs" />
        <ScreenTransitionEventDialog v-if="showTransitionDialog" :event="editingEvent as any" @saved="onDialogSaved"
            @close="closeDialogs" />
        <SlideshowEventDialog v-if="showSlideshowDialog" :event="editingEvent as any" @saved="onDialogSaved"
            @close="closeDialogs" />
        <!-- per-screen sync removed: use BulkSyncDialog from header -->
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { container } from 'tsyringe';
import { AppEventService } from '../../../../model/applications/app-event/app-event-service';
import type { IAppEvent } from '../../../../model/domains/app-event/app-event';
import EventTypeSelectionDialog from './dialogs/event-type-selection-dialog.vue';
import ContentDisplayEventDialog from './dialogs/content-display-event/content-display-event-dialog.vue';
import MusicPlaybackEventDialog from './dialogs/music-playback-event/music-playback-event-dialog.vue';
import StopAudioEventDialog from './dialogs/stop-audio-event/stop-audio-event-dialog.vue';
import ScreenTransitionEventDialog from './dialogs/screen-transition-event/screen-transition-event-dialog.vue';
import SlideshowEventDialog from './dialogs/slideshow-event/slideshow-event-dialog.vue';
// persistence moved into dialog components

const events = ref<IAppEvent[]>([]);
const loading = ref(false);
const selectedEvents = ref<string[]>([]);
const deleting = ref(false);
const executing = ref(false);
const interruptFlag = ref(false);
const showTypeSelection = ref(false);
const showContentDialog = ref(false);
const showMusicDialog = ref(false);
const showTransitionDialog = ref(false);
const showSlideshowDialog = ref(false);
const showStopAudioDialog = ref(false);
const editingEvent = ref<IAppEvent | null>(null);

const scheduleEventService = container.resolve(AppEventService);

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
        case 'StopAudioEvent': return '音楽停止';
        case 'TransitionPageEvent': return '画面遷移';
        case 'SlideshowEvent': return 'スライドショー';
        default: return type;
    }
}

function calculateWaitTime(event: IAppEvent): number {
    const baseTime = 5000; // 5秒
    switch (event.type) {
        case 'ShowContentEvent':
            const showEvent = event as any; // Type assertion for simplicity
            return baseTime + (showEvent.fadeInTime || 0) + (showEvent.fadeOutTime || 0) + (showEvent.duration || 0);
        case 'PlayAudioEvent':
            const audioEvent = event as any;
            return baseTime + (audioEvent.fadeOutDuration || 0);
        case 'StopAudioEvent':
            const stopEvent = event as any;
            return baseTime + (stopEvent.fadeOutDuration || 0);
        case 'TransitionPageEvent':
            const transitionEvent = event as any;
            return baseTime + (transitionEvent.fadeOutDuration || 0);
        case 'SlideshowEvent':
            const slideshowEvent = event as any;
            return baseTime + (slideshowEvent.displayDuration || 0);
        default:
            return baseTime;
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
        case 'StopAudioEvent':
            showStopAudioDialog.value = true;
            break;
        case 'TransitionPageEvent':
            showTransitionDialog.value = true;
            break;
        case 'SlideshowEvent':
            showSlideshowDialog.value = true;
            break;
    }
}

function onEdit(ev: IAppEvent) {
    editingEvent.value = ev;
    switch (ev.type) {
        case 'ShowContentEvent':
            showContentDialog.value = true;
            break;
        case 'PlayAudioEvent':
            showMusicDialog.value = true;
            break;
        case 'StopAudioEvent':
            showStopAudioDialog.value = true;
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
    showStopAudioDialog.value = false;
    editingEvent.value = null;
}

// submit handlers moved into dialogs; watched by @saved

async function onDialogSaved() {
    await getAllScheduleEvents();
    closeDialogs();
}

async function onReload() {
    // Reload local data only (no automatic GAS sync)
    await getAllScheduleEvents();
}

async function onExecute() {
    if (!selectedEvents.value.length || executing.value) return;
    executing.value = true;
    interruptFlag.value = false;

    const selectedEventObjects = events.value.filter(ev => selectedEvents.value.includes(ev.id));

    // ESC リスナー追加
    const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            interruptFlag.value = true;
            event.preventDefault();
        }
    };
    document.addEventListener('keydown', handleKeyDown);

    try {
        for (const event of selectedEventObjects) {
            if (interruptFlag.value) break;

            // 開始実行
            await event.execute(true);

            // 待機時間計算
            const waitTime = calculateWaitTime(event);
            await new Promise(resolve => {
                const timeout = setTimeout(resolve, waitTime);
                // 中断チェック
                const checkInterrupt = () => {
                    if (interruptFlag.value) {
                        clearTimeout(timeout);
                        resolve(void 0);
                    } else {
                        setTimeout(checkInterrupt, 100);
                    }
                };
                checkInterrupt();
            });

            // 終了実行
            await event.execute(false);
        }
    } catch (e) {
        alert('実行中にエラーが発生しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        executing.value = false;
        document.removeEventListener('keydown', handleKeyDown);
    }
}

async function onDeleteSelected() {
    if (!selectedEvents.value.length) return;
    if (!confirm(`${selectedEvents.value.length} 件のイベントを削除しますか？`)) return;
    deleting.value = true;
    try {
        console.log('Deleting events:', selectedEvents.value);
        await scheduleEventService.deleteScheduleEvents(selectedEvents.value);
        selectedEvents.value = [];
        await getAllScheduleEvents();
    } catch (e) {
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        deleting.value = false;
    }
}

async function onDelete(ev: IAppEvent) {
    if (!confirm(`${ev.type} を削除しますか？`)) return;
    try {
        await scheduleEventService.deleteScheduleEvents([ev.id]);
        await getAllScheduleEvents();
    } catch (e) {
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

onMounted(async () => {
    // Only read from IndexedDB on mount — do not auto-sync with GAS
    await getAllScheduleEvents();
});

// per-screen sync removed: use BulkSyncDialog from header for synchronization actions
</script>

<style scoped>
.event-list-editor {
    color: #fff;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.admin-section {
    width: 100%;
    height: 100%;
    padding: 0.5em 0.8em;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    position: relative;
    max-width: 1100px;
    /* center and constrain width to match other admin sections */
    margin: 0 auto;
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
    /* match keyboard-shortcut editor title style: smaller, inline icon */
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
}

.editor-icon {
    font-size: 1.3em;
}

.sync-status {
    position: absolute;
    top: 1em;
    right: 1em;
    background: rgba(0, 0, 0, 0.7);
    color: #fff;
    padding: 0.5em 1em;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 0.5em;
    font-size: 0.9em;
    z-index: 10;
}

.sync-status .sync-icon {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.controls {
    display: none;
    /* replaced by admin-actions for consistency */
}

.admin-actions {
    margin-bottom: 18px;
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.admin-btn {
    padding: 8px 12px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.admin-btn.icon-only {
    padding: 8px;
    border-radius: 8px;
    background: transparent;
    color: #cfe8ff;
    border: 1px solid rgba(255, 255, 255, 0.04);
}

.admin-btn.add-icon {
    padding: 10px;
    border-radius: 12px;
    background: linear-gradient(180deg, #b6d8ff 0%, #8aaeff 100%);
    color: #232b36;
    border: none;
}

.admin-btn.delete-btn {
    background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.admin-btn:disabled,
.admin-btn[disabled] {
    opacity: 0.6;
    cursor: not-allowed;
}

.main-btn {
    /* keep button font-size consistent with other settings (inherit) */
    font-size: inherit;
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
    /* use inherited size for small variant */
    font-size: inherit;
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

.sync-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
}

.sync-dialog {
    background: #333;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    width: 320px;
}

.sync-dialog h3 {
    margin-top: 0;
}

.sync-dialog label {
    display: block;
    margin: 10px 0;
}

.dialog-buttons {
    margin-top: 16px;
    display: flex;
    justify-content: space-between;
}

.dialog-buttons button {
    padding: 8px 16px;
    border: none;
    border-radius: 4px;
    cursor: pointer;
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
    font-size: 1em;
    /* normalize to admin base font size */
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

.execute-btn {
    background: linear-gradient(90deg, #4caf50 0%, #81c784 100%);
}

.execute-btn:hover {
    box-shadow: 0 6px 18px rgba(76, 175, 80, 0.14);
}

@media (max-width: 600px) {
    .admin-section {
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