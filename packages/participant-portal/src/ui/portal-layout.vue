<template>
    <div class="pp" data-testid="portal-layout">
        <header class="pp-header">
            <span class="pp-header__brand">OCTOPUS</span>
            <span class="pp-header__conn" :class="`is-${session.status.value}`" data-testid="portal-conn" role="status">
                <span class="pp-header__dot" aria-hidden="true" />
                {{ connLabel }}
            </span>
        </header>

        <PortalEventBanner v-if="banner" :title="banner.title" :label="banner.label" :to="banner.to" />

        <main class="pp-main">
            <RouterView />
        </main>

        <nav class="pp-tabs" aria-label="メニュー">
            <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="pp-tabs__item" :exact-active-class="'is-active'"
                :active-class="tab.exact ? '' : 'is-active'">
                {{ tab.label }}
                <span v-if="tab.to === '/p/results' && results.stale.value" class="pp-tabs__dot" data-testid="results-new"
                    role="img" aria-label="新しい結果があります" />
            </RouterLink>
        </nav>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, provide } from 'vue';
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { createSessionConnection } from '@octopus/session-hub';
import type { SessionConnection } from '@octopus/session-hub';
import { useParticipantAuth } from '../model/participant-auth';
import { ENTRY_KEY, useEntry } from '../model/use-entry';
import { QUIZ_KEY, useQuiz } from '../model/use-quiz';
import { RESULTS_KEY, useResults } from '../model/use-results';
import { PORTAL_SESSION_KEY, usePortalSession } from '../model/use-portal-session';
import PortalEventBanner from './portal-event-banner.vue';
import './portal-theme.css';

const props = defineProps<{ connection?: SessionConnection }>();

const route = useRoute();
const session = usePortalSession(props.connection ?? createSessionConnection());
provide(PORTAL_SESSION_KEY, session);
// エントリーの状態はレイアウトで1つだけ持ち、バナーと各ページで共有する(「済み」の表示が食い違わないように)
const auth = useParticipantAuth();
const entry = useEntry(session, { memberId: () => auth.currentMember.value?.id ?? null });
provide(ENTRY_KEY, entry);

// クイズの参加者側。回答済みの表示などを、ホームとバナーで共有する
const quiz = useQuiz(session, { memberId: () => auth.currentMember.value?.id ?? null });
provide(QUIZ_KEY, quiz);

// 結果(クイズの順位・当選履歴)。ホストが保存すると更新番号だけが届くので、新しい結果があるときはタブに印を出す
const results = useResults(session);
provide(RESULTS_KEY, results);

const tabs = [
    { to: '/p', label: 'ホーム', exact: true },
    { to: '/p/results', label: '結果', exact: false },
    { to: '/p/me', label: 'マイページ', exact: false },
];

/**
 * 画面上部に固定表示するお知らせ。いま参加者にいちばん関わるもの1つだけを出す。
 *   1. 回答受付中のクイズ(まだ答えていない人)  → ホームへ
 *   2. エントリー受付中(まだの人) / イベント発生中 → イベント画面へ
 * 行き先の画面を開いている間は、同じ内容のバナーを重ねて出さない。接続できていない間は出さない。
 */
const banner = computed(() => {
    if (session.status.value !== 'connected' && session.status.value !== 'reconnecting') return null;
    let found: { label: string; title: string; to: string } | null = null;
    const q = quiz.quiz.value;
    if (q && q.phase === 'answering' && quiz.myAnswer.value === null) {
        found = { label: 'クイズ出題中!', title: q.title || 'クイズに答えよう', to: '/p' };
    } else if (session.event.value) {
        const entering = entry.phase.value === 'open' && !entry.entered.value;
        found = { label: entering ? 'エントリー受付中!' : 'イベント発生中!', title: session.event.value.title, to: '/p/event' };
    }
    return found && route.path !== found.to ? found : null;
});

const connLabel = computed(() => {
    switch (session.status.value) {
        case 'connected':
            return '接続中';
        case 'reconnecting':
            return '再接続中';
        case 'joining':
            return '接続しています';
        case 'waiting':
            return 'イベント待ち';
        case 'ended':
            return '終了';
        default:
            return '未接続';
    }
});

onMounted(() => {
    void session.join();
});
</script>

<style scoped>
.pp-header {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: var(--pp-header-h);
    padding: 0 16px;
    padding-top: env(safe-area-inset-top);
    background: rgba(18, 5, 8, 0.92);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--pp-line);
}

.pp-header__brand {
    font-weight: 900;
    letter-spacing: 0.22em;
    color: var(--pp-gold);
}

.pp-header__conn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--pp-text-muted);
}

.pp-header__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--pp-text-muted);
}

.pp-header__conn.is-connected .pp-header__dot {
    background: var(--pp-ok);
}

.pp-header__conn.is-reconnecting .pp-header__dot,
.pp-header__conn.is-joining .pp-header__dot {
    background: var(--pp-warn);
}

.pp-header__conn.is-error .pp-header__dot {
    background: var(--pp-danger);
}

.pp-main {
    flex: 1;
    width: 100%;
    max-width: 520px;
    margin: 0 auto;
    padding: 16px 16px calc(var(--pp-tabs-h) + 24px + env(safe-area-inset-bottom));
}

.pp-tabs {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 5;
    display: flex;
    height: calc(var(--pp-tabs-h) + env(safe-area-inset-bottom));
    padding-bottom: env(safe-area-inset-bottom);
    background: rgba(18, 5, 8, 0.96);
    border-top: 1px solid var(--pp-line);
}

.pp-tabs__item {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    font-weight: 700;
    color: var(--pp-text-muted);
}

.pp-tabs__item {
    position: relative;
}

/* 新しい結果があるときの印 */
.pp-tabs__dot {
    position: absolute;
    top: 12px;
    left: calc(50% + 1.4em);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--pp-red);
    box-shadow: 0 0 0 2px rgba(18, 5, 8, 0.96), 0 0 10px var(--pp-red);
}

.pp-tabs__item.is-active {
    color: var(--pp-gold);
    box-shadow: inset 0 3px 0 var(--pp-gold);
}
</style>
