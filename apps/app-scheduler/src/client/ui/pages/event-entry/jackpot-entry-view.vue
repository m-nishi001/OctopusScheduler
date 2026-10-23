<template>
    <EntryStageView listing="pool" />
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { container } from 'tsyringe';
import {
    HostAgent,
    PORTAL_EVENT_CLOSE_ENTRY,
    PORTAL_EVENT_ENSURE_ENTRY,
    readPortalEvent,
    useConnectionState,
} from '@octopus/session-hub';
import { hostEventCommand } from './host-event-command';
import EntryStageView from './entry-stage-view.vue';

/**
 * ジャックポットのエントリー画面(オープニングの次、説明の前)。クイズのエントリー画面と同じ見た目の共通画面。
 *   - 参加者全員(自動): 今日ポータルから参加した管理者以外の人が自動でエントリー済み。一覧を映すだけで、書き込みは無い。
 *   - エントリーした人のみ: 表示した時点でエントリー受付を始め(まだ始めていないときだけ)、離れるときに締め切って一覧を残す。
 * 管理端末で抽選の対象を切り替えると、その場でこの画面も切り替わる。
 */
const command = (type: string): Promise<void> => hostEventCommand(type, 'jackpot-entry');

const hasHost = container.isRegistered(HostAgent);
const state = hasHost ? useConnectionState(container.resolve(HostAgent).connection) : null;
const entrantsMode = computed(() => readPortalEvent(state?.value.roomState?.data)?.pool === 'entrants');

// 「エントリーした人のみ」になったら(最初から、または途中で切り替えたら)受付を始める
watch(
    entrantsMode,
    (on) => {
        if (on) void command(PORTAL_EVENT_ENSURE_ENTRY).catch((e) => console.error('エントリー受付を開始できませんでした', e));
    },
    { immediate: true },
);

// 画面を離れる(説明へ進む)とき、受付中なら締め切る(自動のときは受付が無いので何もしない)
onBeforeRouteLeave(async () => {
    await command(PORTAL_EVENT_CLOSE_ENTRY).catch(() => undefined);
});
</script>
