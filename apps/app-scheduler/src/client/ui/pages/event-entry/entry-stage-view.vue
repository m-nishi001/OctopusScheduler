<template>
    <div class="stage" data-testid="entry-stage">
        <header class="stage__head">
            <template v-if="event">
                <p class="stage__label" :class="{ 'is-closed': event.entry && !event.entry.open }" data-testid="stage-label">{{ label }}</p>
                <h1 class="stage__title" data-testid="stage-title">{{ event.title }}</h1>
            </template>
            <template v-else>
                <p class="stage__label is-closed" data-testid="stage-label">イベントはまだ始まっていません</p>
                <h1 class="stage__title is-dim">エントリー受付</h1>
            </template>
        </header>

        <div class="stage__count" data-testid="stage-count-box">
            <span class="stage__count-num" data-testid="stage-count">{{ total }}</span>
            <span class="stage__count-unit">人がエントリー</span>
        </div>

        <main class="stage__bubbles">
            <EntryBubbles :entrants="entrants" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { HostAgent, readPortalEvent, useConnectionState, useRoundAnswers } from '@octopus/session-hub';
import { createMemberPhotoCache } from '@octopus/game-jackpot';
import EntryBubbles from './entry-bubbles.vue';
import type { Entrant } from './entry-bubbles.vue';

/**
 * 会場の大きな画面に出す、エントリー受付のステージ。参加者がエントリーするたびにバブルがポンと現れる。
 * 管理端末が「エントリー受付」を開くと、この画面にエントリー済みの人が顔写真つきで並ぶ。
 * 顔写真はこの端末(ホスト)が持つジャックポットのメンバー写真から引き、参加者のスマホへは渡さない。
 */
const agent = container.resolve(HostAgent);
const state = useConnectionState(agent.connection);

const event = computed(() => readPortalEvent(state.value.roomState?.data));
const entryKey = computed(() => event.value?.entry?.key ?? null);
const roster = useRoundAnswers(agent.connection, state, entryKey);

const label = computed(() => {
    const entry = event.value?.entry;
    if (!entry) return 'エントリー受付はまもなく';
    return entry.open ? 'エントリー受付中!' : 'エントリー受付は終了しました';
});

// 顔写真。名簿に無い・写真が無い人は頭文字のアバターになる。
const photos = createMemberPhotoCache();
const photoTick = ref(0);
watch(
    () => roster.answers.value.map((a) => a.memberId).filter((id): id is string => !!id),
    async (ids) => {
        await photos.ensure(ids);
        photoTick.value++;
    },
    { immediate: true },
);
onUnmounted(() => photos.dispose());

const entrants = computed<Entrant[]>(() => {
    void photoTick.value;
    return roster.answers.value.map((a) => ({
        id: a.memberId ?? a.deviceId,
        name: a.label,
        photoUrl: a.memberId ? photos.get(a.memberId) : undefined,
    }));
});
// 一覧の取得を待たずに、更新の通知で届く最新の人数を出す
const total = computed(() => Math.max(entrants.value.length, roster.count.value));
</script>

<style scoped>
.stage {
    position: fixed;
    inset: 0;
    display: flex;
    flex-direction: column;
    gap: 2vh;
    padding: 4vh 4vw;
    box-sizing: border-box;
    color: #fff8e1;
    font-family: var(--ui-font-family, system-ui, -apple-system, 'Segoe UI', 'Hiragino Sans', 'Yu Gothic UI', sans-serif);
    background:
        radial-gradient(ellipse at 50% 30%, rgba(255, 213, 74, 0.16), transparent 55%),
        radial-gradient(ellipse at 50% 100%, #6e0a1a, transparent 70%),
        #120508;
}

.stage__head {
    text-align: center;
}

.stage__label {
    margin: 0;
    font-size: clamp(1.2rem, 3vw, 2.6rem);
    font-weight: 900;
    letter-spacing: 0.12em;
    color: #ffd54a;
    text-shadow: 0 0 22px rgba(255, 213, 74, 0.6);
}

.stage__label.is-closed {
    color: rgba(255, 248, 225, 0.7);
    text-shadow: none;
}

.stage__title {
    margin: 0.4vh 0 0;
    font-size: clamp(1.8rem, 5vw, 4.4rem);
    font-weight: 900;
    line-height: 1.2;
    color: #fff2b0;
    word-break: break-word;
}

.stage__title.is-dim {
    opacity: 0.6;
}

.stage__count {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 1vw;
}

.stage__count-num {
    font-size: clamp(3rem, 9vw, 8rem);
    font-weight: 900;
    font-variant-numeric: tabular-nums;
    line-height: 1;
    color: #ffd54a;
    text-shadow: 0 0 30px rgba(255, 213, 74, 0.7);
}

.stage__count-unit {
    font-size: clamp(1rem, 2.4vw, 2.2rem);
    font-weight: 800;
}

.stage__bubbles {
    flex: 1;
    min-height: 0;
}
</style>
