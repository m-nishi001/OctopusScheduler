<template>
    <div class="ui-sync-status" :class="`ui-sync-status--${status}`" :title="tooltip">
        <span class="ui-sync-status__dot" aria-hidden="true"></span>
        <span class="ui-sync-status__label">{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export type SyncStatus = 'idle' | 'syncing' | 'error';

const props = defineProps<{ status: SyncStatus; lastError?: string | null }>();

const label = computed(() => (props.status === 'syncing' ? '同期中...' : props.status === 'error' ? '同期エラー' : '同期済み'));
const tooltip = computed(() => (props.status === 'error' ? (props.lastError ?? '') : ''));
</script>

<style scoped>
.ui-sync-status {
    display: inline-flex;
    align-items: center;
    gap: var(--ui-space-2, 8px);
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
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

@keyframes ui-sync-pulse {
    50% {
        opacity: 0.35;
    }
}
</style>
