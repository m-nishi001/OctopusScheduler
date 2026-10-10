<template>
    <div v-if="visible" class="host-badge" :class="`is-${label.tone}`" role="status" data-testid="host-badge">
        <span class="host-badge__dot" aria-hidden="true" />
        <span>{{ state.session?.name }}・{{ label.text }}</span>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { container } from 'tsyringe';
import { HostAgent, useConnectionState } from '@octopus/session-hub';
import { describePhase } from '../connection-labels';

/**
 * ホスト端末で他の画面(ジャックポット等)を投影している間も、セッションとの接続状態を
 * 隅に小さく出す。切断・再接続中を操作者が気づけるようにするためのもので、
 * 投影の邪魔にならないようクリックは通さない。接続が正常な間は目立たない。
 */
const agent = container.resolve(HostAgent);
const state = useConnectionState(agent.connection);

const visible = computed(
    () => state.value.role === 'host' && !!state.value.session && state.value.phase !== 'idle',
);
const label = computed(() => describePhase(state.value.phase, state.value.failureCount));
</script>

<style scoped>
.host-badge {
    position: fixed;
    right: 8px;
    bottom: 8px;
    z-index: 2147483000;
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    color: #fff;
    background: rgba(0, 0, 0, 0.45);
    opacity: 0.35;
    pointer-events: none;
}

.host-badge.is-warn,
.host-badge.is-error {
    opacity: 0.95;
}

.host-badge__dot { width: 8px; height: 8px; border-radius: 50%; background: #888; }
.is-ok .host-badge__dot { background: #4caf50; }
.is-warn .host-badge__dot { background: #ffb300; }
.is-error .host-badge__dot { background: #f44336; }
</style>
