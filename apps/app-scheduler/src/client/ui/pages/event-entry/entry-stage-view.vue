<template>
    <div class="stage" data-testid="entry-stage">
        <header class="stage__head">
            <template v-if="event">
                <p class="stage__label" :class="{ 'is-closed': !autoMode && event.entry && !event.entry.open }" data-testid="stage-label">{{ label }}</p>
                <h1 class="stage__title" data-testid="stage-title">{{ event.title }}</h1>
            </template>
            <template v-else>
                <p class="stage__label is-closed" data-testid="stage-label">イベントはまだ始まっていません</p>
                <h1 class="stage__title is-dim">エントリー受付</h1>
            </template>
        </header>

        <div class="stage__count" data-testid="stage-count-box">
            <span class="stage__count-num" data-testid="stage-count">{{ total }}</span>
            <span class="stage__count-unit">{{ autoMode ? '人が自動でエントリー済み' : '人がエントリー' }}</span>
        </div>

        <main class="stage__bubbles">
            <EntryBubbles :entrants="entrants" :label="autoMode ? '自動でエントリーした人' : undefined" />
        </main>
    </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { container } from 'tsyringe';
import { HostAgent, readPortalEvent, useConnectionState, useRoundAnswers } from '@octopus/session-hub';
import { useAutoEntrants } from './use-auto-entrants';
import { AccountsRepository, MemberPhotoCache } from '@octopus/accounts';
import { useRosterPhotos } from './use-roster-photos';
import EntryBubbles from './entry-bubbles.vue';
import type { Entrant } from './entry-bubbles.vue';

/**
 * 会場の大きな画面に出す、エントリー受付のステージ。参加者がエントリーするたびにバブルがポンと現れる。
 * 管理端末が「エントリー受付」を開くと、この画面にエントリー済みの人が顔写真つきで並ぶ。
 * 顔写真は共通の名簿(Member.photo)から引く。ハッシュ別の端末内キャッシュを通すので、同じ写真は二度取りに行かない。
 */
const props = withDefaults(
    defineProps<{
        /**
         * 誰を並べるか。
         *   entries: エントリーした人(受付の回答一覧。既定)
         *   pool: イベントの抽選の対象に従う(自動なら今日参加した管理者以外の全員、「エントリーした人のみ」ならエントリーした人)
         */
        listing?: 'entries' | 'pool';
    }>(),
    { listing: 'entries' },
);

const agent = container.resolve(HostAgent);
const state = useConnectionState(agent.connection);

const event = computed(() => readPortalEvent(state.value.roomState?.data));
const entryKey = computed(() => event.value?.entry?.key ?? null);
const roster = useRoundAnswers(agent.connection, state, entryKey);

// 自動: 全員が自動でエントリー済み。受付(回答ラウンド)は使わず、名簿を読むだけで何も書かない。
const autoMode = computed(() => props.listing === 'pool' && event.value !== null && event.value.pool !== 'entrants');
const auto = useAutoEntrants({
    agent,
    active: autoMode,
    signal: computed(() => state.value.presence?.clientCount ?? 0),
});

const label = computed(() => {
    if (autoMode.value) return '参加者は自動でエントリーされます';
    const entry = event.value?.entry;
    if (!entry) return 'エントリー受付はまもなく';
    return entry.open ? 'エントリー受付中!' : 'エントリー受付は終了しました';
});

// 顔写真。名簿に無い・写真が無い人は頭文字のアバターになる。
const photos = useRosterPhotos(container.resolve(AccountsRepository), container.resolve(MemberPhotoCache));
watch(
    () => (autoMode.value ? auto.entrants.value.map((a) => a.memberId) : roster.answers.value.map((a) => a.memberId).filter((id): id is string => !!id)),
    (ids) => photos.ensure(ids),
    { immediate: true },
);

const entrants = computed<Entrant[]>(() => {
    void photos.version.value;
    if (autoMode.value) {
        return auto.entrants.value.map((a) => ({ id: a.memberId, name: a.name, photoUrl: photos.urlOf(a.memberId) }));
    }
    return roster.answers.value.map((a) => ({
        id: a.memberId ?? a.deviceId,
        name: a.label,
        photoUrl: a.memberId ? photos.urlOf(a.memberId) : undefined,
    }));
});
// 一覧の取得を待たずに、更新の通知で届く最新の人数を出す
const total = computed(() => (autoMode.value ? entrants.value.length : Math.max(entrants.value.length, roster.count.value)));
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
