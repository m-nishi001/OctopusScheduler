<template>
    <div class="sync-status" :class="`sync-status--${status}`" :title="tooltip">
        <span class="sync-status-dot" aria-hidden="true"></span>
        <span class="sync-status-label">{{ label }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { BackgroundSyncStatus } from '../composables/use-background-sync';

const props = defineProps<{
    status: BackgroundSyncStatus;
    lastError?: string | null;
}>();

const label = computed(() => {
    switch (props.status) {
        case 'syncing':
            return '同期中...';
        case 'error':
            return '同期エラー';
        default:
            return '同期済み';
    }
});

const tooltip = computed(() => (props.status === 'error' ? props.lastError ?? '' : ''));
</script>

<style scoped>
.sync-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85rem;
    color: #cfd6dd;
}

.sync-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #6c7681;
}

.sync-status--syncing .sync-status-dot {
    background: #4a90e2;
    animation: sync-status-pulse 1s ease-in-out infinite;
}

.sync-status--error .sync-status-dot {
    background: #e25a4a;
}

.sync-status--error .sync-status-label {
    color: #ffb4a8;
}

@keyframes sync-status-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
}
</style>
