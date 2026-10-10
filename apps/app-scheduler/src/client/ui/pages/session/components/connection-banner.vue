<template>
    <div class="connection-banner" :class="`is-${label.tone}`" role="status" aria-live="polite">
        <span class="connection-banner__dot" aria-hidden="true" />
        <span class="connection-banner__text">{{ label.text }}</span>
        <span v-if="detail" class="connection-banner__detail">{{ detail }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ConnectionPhase } from '@octopus/session-hub';
import { describePhase } from '../connection-labels';

const props = defineProps<{ phase: ConnectionPhase; failureCount?: number; detail?: string | null }>();
const label = computed(() => describePhase(props.phase, props.failureCount ?? 0));
</script>

<style scoped>
.connection-banner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 0.85rem;
    background: rgba(255, 255, 255, 0.08);
}

.connection-banner__dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #888;
}

.is-ok .connection-banner__dot { background: #4caf50; }
.is-warn .connection-banner__dot { background: #ffb300; }
.is-error .connection-banner__dot { background: #f44336; }
.connection-banner__detail { opacity: 0.7; }
</style>
