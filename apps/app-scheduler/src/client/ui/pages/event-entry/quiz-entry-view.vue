<template>
    <EntryStageView />
</template>

<script setup lang="ts">
import { useQuizStep } from '@octopus/game-quiz';
import { PORTAL_EVENT_CLOSE_ENTRY, PORTAL_EVENT_ENSURE_ENTRY } from '@octopus/session-hub';
import { hostEventCommand } from './host-event-command';
import EntryStageView from './entry-stage-view.vue';

/**
 * クイズのエントリー画面(イントロの次)。会場の画面に、いまエントリーしている人数を映す。
 * 表示した時点でエントリー受付を自動で始める(まだ受付を始めていないイベントだけ。受付済みの一覧は触らない)。
 * 次へ進む(出題が始まる)と、受付は出題の回答受付に置き換わるので、その前に受付を締め切って一覧を残す。
 */
const hostCommand = (type: string): Promise<void> => hostEventCommand(type, 'quiz-entry');

useQuizStep({
    page: 'entry',
    next: 'quiz-play',
    onShown: () => hostCommand(PORTAL_EVENT_ENSURE_ENTRY),
    beforeNext: () => hostCommand(PORTAL_EVENT_CLOSE_ENTRY).catch(() => undefined),
});
</script>
