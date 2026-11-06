<template>
    <div class="event-list-editor">
        <UiToolbar>
            <UiButton variant="primary" icon="add" :disabled="loading" @click.prevent="onAdd">追加</UiButton>
            <UiButton v-if="selectedEvents.length" variant="danger" icon="delete" :loading="deleting"
                @click.prevent="onDeleteSelected">選択を削除({{ selectedEvents.length }})</UiButton>
            <TableIoToolbar :count="events.length" :on-export="eventIo.onExport" media-label="素材も含める(ZIP)"
                @import="importOpen = true" />
            <UiButton icon="play" :disabled="!selectedEvents.length" :loading="executing"
                @click.prevent="onExecute">実行</UiButton>
        </UiToolbar>

        <DataTable :columns="columns" :rows="rows" row-key="id" selectable v-model:selected="selectedEvents"
            :loading="loading" empty-text="イベントがありません。">
            <template #cell-actions="{ row }">
                <div class="row-actions">
                    <UiButton size="sm" icon="edit" icon-only aria-label="編集" :disabled="loading"
                        @click="onEdit(row.ev)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除" :disabled="loading"
                        @click="onDelete(row.ev)" />
                </div>
            </template>
        </DataTable>

        <TableImportDialog v-model="importOpen" :on-preview="eventIo.onPreviewImport" allow-replace media-label="素材フォルダ"
            media-hint="CSVの「素材」列のファイル名と同じファイルが入ったフォルダ。ZIPなら不要です。置き換えでも素材は削除しません(アセットタブで管理)" />

        <EventTypeSelectionDialog v-if="showTypeSelection" @select="onTypeSelected"
            @close="showTypeSelection = false" />
        <ScheduledEventDialog v-if="dialogType" :type="dialogType" :event="editingEvent" @saved="onDialogSaved"
            @close="closeDialogs" />
        <!-- per-screen sync removed: background sync runs automatically -->
    </div>
</template>

<script setup lang="ts">
import { DataTable, TableImportDialog, TableIoToolbar, UiButton, UiToolbar, toast, useConfirm } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { ref, onMounted, computed } from 'vue';
import { container } from 'tsyringe';
import { AppEventService } from '../../../../control/app-event/app-event-service';
import { executeAppEvent, type AppEvent, type AppEventType } from '../../../../control/app-event/app-event';
import { AssetService } from '../../../../control/asset/asset-service';
import { eventTableIo } from '../../../../control/event-table/event-table-io';
import EventTypeSelectionDialog from './dialogs/event-type-selection-dialog.vue';
import ScheduledEventDialog from './dialogs/scheduled-event-dialog.vue';

const { confirmDelete } = useConfirm();

const events = ref<AppEvent[]>([]);
const loading = ref(false);
const selectedEvents = ref<string[]>([]);
const deleting = ref(false);
const executing = ref(false);
const interruptFlag = ref(false);
const showTypeSelection = ref(false);
/** 開いている追加・編集ダイアログの種類(閉じていれば null)。 */
const dialogType = ref<AppEventType | null>(null);
const editingEvent = ref<AppEvent | null>(null);

const scheduleEventService = container.resolve(AppEventService);
const importOpen = ref(false);

// CSV の書き出し・取込。取り込んだら一覧を読み直す。
const eventIo = eventTableIo({
    assets: container.resolve(AssetService),
    events: scheduleEventService,
    afterImport: getAllScheduleEvents,
    warn: (message) => toast.error(message),
});

const columns: DataTableColumn[] = [
    { key: 'name', label: 'イベント名', sortable: true },
    { key: 'typeLabel', label: '種別', sortable: true },
    { key: 'start', label: '開始' },
    { key: 'end', label: '終了' },
    { key: 'actions', label: '操作' },
];

const rows = computed(() =>
    events.value.map((ev) => ({
        id: ev.id,
        name: ev.type,
        typeLabel: getTypeLabel(ev.type),
        start: formatDate(ev.startTime),
        end: formatDate(ev.endTime),
        ev,
    }))
);

function getTypeLabel(type: string): string {
    switch (type) {
        case 'AudioEvent': return '音楽';
        case 'ScreenEvent': return 'スクリーン';
        case 'TransitionPageEvent': return '画面遷移';
        default: return type;
    }
}

/** 開始してから終了するまでの待ち時間(ミリ秒)。 */
function calculateWaitTime(event: AppEvent): number {
    const baseTime = 5000; // 5秒
    switch (event.type) {
        case 'AudioEvent':
            return baseTime + (event.fadeOutSec || 0) * 1000;
        case 'ScreenEvent':
            return baseTime;
        case 'TransitionPageEvent':
            return baseTime + (event.fadeOutDuration || 0) * 1000;
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
        toast.error('イベント取得に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
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
    dialogType.value = type as AppEventType;
}

function onEdit(ev: AppEvent) {
    editingEvent.value = ev;
    dialogType.value = ev.type;
}

function closeDialogs() {
    dialogType.value = null;
    editingEvent.value = null;
}

// submit handlers moved into dialogs; watched by @saved

async function onDialogSaved() {
    await getAllScheduleEvents();
    closeDialogs();
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
            await executeAppEvent(event, true);

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
            await executeAppEvent(event, false);
        }
    } catch (e) {
        toast.error('実行中にエラーが発生しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        executing.value = false;
        document.removeEventListener('keydown', handleKeyDown);
    }
}

async function onDeleteSelected() {
    if (!selectedEvents.value.length) return;
    if (!(await confirmDelete(`${selectedEvents.value.length} 件のイベントを削除しますか？`))) return;
    deleting.value = true;
    try {
        await scheduleEventService.deleteScheduleEvents(selectedEvents.value);
        selectedEvents.value = [];
        await getAllScheduleEvents();
    } catch (e) {
        toast.error('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        deleting.value = false;
    }
}

async function onDelete(ev: AppEvent) {
    if (!(await confirmDelete(`${ev.type} を削除しますか？`))) return;
    try {
        await scheduleEventService.deleteScheduleEvents([ev.id]);
        await getAllScheduleEvents();
    } catch (e) {
        toast.error('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

onMounted(async () => {
    // Only read from IndexedDB on mount — do not auto-sync with GAS
    await getAllScheduleEvents();
});

// per-screen sync removed: background sync runs automatically
</script>

<style scoped>
.row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}
</style>
