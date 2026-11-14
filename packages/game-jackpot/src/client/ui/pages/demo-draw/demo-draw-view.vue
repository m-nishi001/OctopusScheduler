<template>
    <DrawOrchestratorPage />
</template>

<script lang="ts">
import DrawOrchestratorPage from '../main-draw/draw-orchestrator-view.vue';

/**
 * デモ抽選(練習抽選)の画面。本番と同じルーレット/スロットの画面を、練習として開く(ルートの meta.demoDraw)。
 * 結果はメモリだけの専用の置き場に入れ、記録・公開しない。ホスト接続中も、参加者には「デモ抽選」のページ名だけを公開する。
 */
export default {
    name: 'DemoDrawView',
    components: { DrawOrchestratorPage },
};
</script>
