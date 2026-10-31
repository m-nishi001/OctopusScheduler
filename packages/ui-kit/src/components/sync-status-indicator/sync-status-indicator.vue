<template>
    <span class="ui-sync-wrap">
        <button type="button" class="ui-sync-status" :class="`ui-sync-status--${status}`" :title="tooltip" data-testid="sync-status"
            @click="open = true">
            <span class="ui-sync-status__dot" aria-hidden="true"></span>
            <span class="ui-sync-status__label">{{ label }}</span>
        </button>
        <UiDialog v-model="open" title="同期の状態" size="lg">
            <p v-if="lastError && status === 'error'" class="ui-sync-status__summary">{{ lastError }}</p>
            <p v-if="!log || log.length === 0" class="ui-sync-status__empty">失敗や、他の端末の変更を反映した記録はありません。</p>
            <div v-else class="ui-sync-status__scroll">
                <table class="ui-sync-status__table" data-testid="sync-log">
                    <thead>
                        <tr><th>時刻</th><th>対象</th><th>結果</th><th>理由</th></tr>
                    </thead>
                    <tbody>
                        <tr v-for="(entry, i) in log" :key="i" :class="{ 'is-failure': entry.event !== 'pulledFromOther' }">
                            <td class="ui-sync-status__time">{{ formatTime(entry.at) }}</td>
                            <td>{{ targetLabel(entry) }}</td>
                            <td>{{ EVENT_LABELS[entry.event] }}</td>
                            <td class="ui-sync-status__reason">{{ entry.error ?? '' }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </UiDialog>
    </span>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import UiDialog from '../ui-dialog/ui-dialog.vue';

export type SyncStatus = 'idle' | 'syncing' | 'error';

/** 同期のログ1件(失敗と、他の端末の変更を反映した記録)。 */
export interface SyncLogItem {
    /** 記録した時刻(ミリ秒) */
    at: number;
    /** 同期の対象の種類(表示名は kindLabels で渡す) */
    kind: string;
    /** 対象のid(種類ごとに1件のものは kind と同じ。違うときは表示名のあとに併記する) */
    id: string;
    event: 'pushFailed' | 'pullFailed' | 'syncFailed' | 'pulledFromOther';
    /** 失敗の理由の全文 */
    error?: string;
}

const props = defineProps<{ status: SyncStatus; lastError?: string | null; log?: SyncLogItem[]; kindLabels?: Record<string, string> }>();

const open = ref(false);

const EVENT_LABELS: Record<SyncLogItem['event'], string> = {
    pushFailed: '送信に失敗',
    pullFailed: '取り込みに失敗',
    syncFailed: '同期に失敗',
    pulledFromOther: '他の端末の変更を反映',
};

const label = computed(() => (props.status === 'syncing' ? '同期中...' : props.status === 'error' ? '同期エラー(押すと詳細)' : '同期済み'));
const tooltip = computed(() => (props.status === 'error' ? (props.lastError ?? '') : '押すと同期の詳細'));

function targetLabel(entry: SyncLogItem): string {
    const name = entry.kind === 'sync' ? '同期' : (props.kindLabels?.[entry.kind] ?? entry.kind);
    return entry.id === entry.kind || entry.kind === 'sync' ? name : `${name} (${entry.id})`;
}

function formatTime(at: number): string {
    return new Date(at).toLocaleTimeString('ja-JP', { hour12: false });
}
</script>

<style scoped>
.ui-sync-wrap {
    display: inline-flex;
}

.ui-sync-status {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
    cursor: pointer;
}

.ui-sync-status:hover .ui-sync-status__label {
    text-decoration: underline;
}

.ui-sync-status__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ui-text-muted, #cfd6dd);
    opacity: 0.6;
}

.ui-sync-status--syncing .ui-sync-status__dot {
    background: var(--ui-accent, #aee1ff);
    opacity: 1;
    animation: ui-sync-pulse 1s ease-in-out infinite;
}

.ui-sync-status--error .ui-sync-status__dot {
    background: var(--ui-danger, #e5484d);
    opacity: 1;
}

.ui-sync-status--error .ui-sync-status__label {
    color: var(--ui-danger, #e5484d);
}

.ui-sync-status__summary {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-danger, #e5484d);
    overflow-wrap: anywhere;
}

.ui-sync-status__empty {
    margin: 0;
    color: var(--ui-text-muted, #cfd6dd);
}

.ui-sync-status__scroll {
    overflow-x: auto;
}

.ui-sync-status__table {
    width: 100%;
    border-collapse: collapse;
    font-size: var(--ui-font-sm, 0.875rem);
}

.ui-sync-status__table th,
.ui-sync-status__table td {
    padding: var(--ui-space-1, 4px) var(--ui-space-2, 8px);
    border-bottom: 1px solid var(--ui-border, #3a4048);
    text-align: left;
    vertical-align: top;
}

.ui-sync-status__table th {
    color: var(--ui-text-muted, #cfd6dd);
    font-weight: 600;
    white-space: nowrap;
}

.ui-sync-status__time {
    white-space: nowrap;
}

.ui-sync-status__reason {
    overflow-wrap: anywhere;
}

.ui-sync-status__table tr.is-failure td:nth-child(3) {
    color: var(--ui-danger, #e5484d);
}

@keyframes ui-sync-pulse {
    50% {
        opacity: 0.35;
    }
}
</style>
