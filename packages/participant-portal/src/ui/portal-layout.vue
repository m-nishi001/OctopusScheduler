<template>
    <div class="pp" data-testid="portal-layout">
        <header class="pp-header">
            <span class="pp-header__brand">OCTOPUS</span>
            <span class="pp-header__conn" :class="`is-${session.status.value}`" data-testid="portal-conn" role="status">
                <span class="pp-header__dot" aria-hidden="true" />
                {{ connLabel }}
            </span>
        </header>

        <PortalEventBanner v-if="showBanner && session.event.value" :title="session.event.value.title" :label="bannerLabel" />

        <main class="pp-main">
            <RouterView />
        </main>

        <nav class="pp-tabs" aria-label="メニュー">
            <RouterLink v-for="tab in tabs" :key="tab.to" :to="tab.to" class="pp-tabs__item" :exact-active-class="'is-active'"
                :active-class="tab.exact ? '' : 'is-active'">
                {{ tab.label }}
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

// エントリー受付中でまだの人には、バナーでも促す
const bannerLabel = computed(() => (entry.phase.value === 'open' && !entry.entered.value ? 'エントリー受付中!' : 'イベント発生中!'));

const tabs = [
    { to: '/p', label: 'ホーム', exact: true },
    { to: '/p/me', label: 'マイページ', exact: false },
];

// 参加画面を開いている間は、同じ内容のバナーを重ねて出さない
const showBanner = computed(() => route.name !== 'participant-event' && (session.status.value === 'connected' || session.status.value === 'reconnecting'));

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

.pp-tabs__item.is-active {
    color: var(--pp-gold);
    box-shadow: inset 0 3px 0 var(--pp-gold);
}
</style>
