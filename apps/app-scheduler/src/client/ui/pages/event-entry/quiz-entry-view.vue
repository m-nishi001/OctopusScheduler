<template>
    <EntryStageView />
</template>

<script setup lang="ts">
import { container } from 'tsyringe';
import { useQuizStep } from '@octopus/game-quiz';
import { HostAgent, PORTAL_EVENT_CLOSE_ENTRY, PORTAL_EVENT_ENSURE_ENTRY, PORTAL_EVENT_NS } from '@octopus/session-hub';
import EntryStageView from './entry-stage-view.vue';

/**
 * クイズのエントリー画面(イントロの次)。会場の画面に、いまエントリーしている人数を映す。
 * 表示した時点でエントリー受付を自動で始める(まだ受付を始めていないイベントだけ。受付済みの一覧は触らない)。
 * 次へ進む(出題が始まる)と、受付は出題の回答受付に置き換わるので、その前に受付を締め切って一覧を残す。
 */
const hostCommand = async (type: string): Promise<void> => {
    if (!container.isRegistered(HostAgent)) return;
    const agent = container.resolve(HostAgent);
    if (!agent.active) return; // プレビューなど、ホストとして接続していないときは何もしない
    // ホスト自身が、管理端末から届いたときと同じ経路でイベントのコマンドを処理する
    await agent.router.dispatch({
        seq: 0,
        requestId: `quiz-entry-${type}`,
        game: PORTAL_EVENT_NS,
        type,
        payload: undefined,
        issuedBy: agent.connection.state.deviceId ?? 'host',
        issuerRole: 'host',
        atMs: Date.now(),
    });
};

useQuizStep({
    page: 'entry',
    next: 'quiz-play',
    onShown: () => hostCommand(PORTAL_EVENT_ENSURE_ENTRY),
    beforeNext: () => hostCommand(PORTAL_EVENT_CLOSE_ENTRY).catch(() => undefined),
});
</script>
