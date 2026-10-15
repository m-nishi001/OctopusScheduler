<template>
    <section class="pp-event">
        <template v-if="session.event.value">
            <p class="pp-event__label">イベント発生中!</p>
            <h1 class="pp-event__title" data-testid="event-title">{{ session.event.value.title }}</h1>

            <article v-if="entry.phase.value === 'none'" class="pp-card pp-event__panel" data-testid="entry-none">
                <p class="pp-muted">エントリーの受付は、このあと始まります。この画面を開いたままお待ちください。</p>
            </article>

            <!-- 抽選が始まったら、「お待ちください」ではなく進行状況と当選結果を出す -->
            <template v-else-if="entry.entered.value && jackpotActive">
                <JackpotWaiting />
                <JackpotCard />
            </template>

            <article v-else-if="entry.entered.value" class="pp-card pp-event__panel pp-event__done" data-testid="entry-done">
                <span class="pp-event__check" aria-hidden="true">✓</span>
                <p class="pp-event__done-title">エントリーしました!</p>
                <p class="pp-muted">
                    {{ entry.phase.value === 'open' ? '会場の画面に表示されます。このままお待ちください。' : '受付は終了しました。結果をお待ちください。' }}
                </p>
            </article>

            <article v-else-if="entry.phase.value === 'open'" class="pp-event__panel pp-event__open" data-testid="entry-open">
                <button type="button" class="pp-entry-button" :disabled="entry.submitting.value" data-testid="entry-button" @click="entry.enter">
                    <span class="pp-entry-button__main">{{ entry.submitting.value ? '送信中…' : 'エントリー' }}</span>
                    <span class="pp-entry-button__sub">タップして参加する</span>
                </button>
                <p class="pp-muted">押すと、会場の画面にあなたが表示されます。</p>
                <p v-if="entry.message.value" class="pp-event__error" role="alert" data-testid="entry-error">{{ entry.message.value }}</p>
            </article>

            <article v-else class="pp-card pp-event__panel" data-testid="entry-closed">
                <p class="pp-event__done-title">エントリーの受付は終了しました</p>
                <p class="pp-muted">{{ entry.message.value || '次の機会をお待ちください。' }}</p>
            </article>
        </template>
        <template v-else>
            <h1 class="pp-title" data-testid="event-none">イベントは終了しました</h1>
            <p class="pp-muted">次のイベントが始まると、ホーム画面の上にお知らせが出ます。</p>
            <RouterLink to="/p" class="pp-button pp-button--ghost">ホームへ戻る</RouterLink>
        </template>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { useEntryContext } from '../../model/use-entry';
import { usePortalContext } from '../../model/use-portal-session';
import { readJackpotView } from '../../model/activity';
import JackpotCard from '../components/jackpot-card.vue';
import JackpotWaiting from '../components/jackpot-waiting.vue';

const session = usePortalContext();
const entry = useEntryContext();
/** ホストがジャックポットの状態を公開している(説明・抽選の最中、または結果が出ている)。 */
const jackpotActive = computed(() => readJackpotView(session.state.value.roomState?.data) !== null);
</script>

<style scoped>
.pp-event {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 14px;
}

.pp-event__label {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--pp-gold);
}

.pp-event__title {
    margin: 0;
    font-size: 2rem;
    font-weight: 900;
    line-height: 1.25;
    color: var(--pp-gold-light);
    text-shadow: 0 0 22px rgba(255, 213, 74, 0.45);
}

.pp-event__panel {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    text-align: center;
}

.pp-event__open {
    padding: 8px 0;
}

/* 親指で押しやすい大きな丸ボタン。ゆっくり光って「押してほしい」ことが分かるようにする */
.pp-entry-button {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    width: min(100%, 260px);
    aspect-ratio: 1 / 1;
    border: 0;
    border-radius: 50%;
    font: inherit;
    color: var(--pp-ink);
    background: radial-gradient(circle at 35% 28%, var(--pp-gold-light), var(--pp-gold) 45%, var(--pp-gold-deep));
    box-shadow:
        0 0 0 6px rgba(255, 213, 74, 0.25),
        0 14px 40px rgba(255, 140, 0, 0.45);
    cursor: pointer;
    animation: pp-entry-glow 1.8s ease-in-out infinite;
}

.pp-entry-button:active {
    transform: scale(0.97);
}

.pp-entry-button:disabled {
    opacity: 0.7;
    animation: none;
    cursor: default;
}

.pp-entry-button__main {
    font-size: 2rem;
    font-weight: 900;
    letter-spacing: 0.06em;
}

.pp-entry-button__sub {
    font-size: 0.85rem;
    font-weight: 700;
}

.pp-event__done {
    border-color: var(--pp-gold);
}

.pp-event__check {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    border-radius: 50%;
    font-size: 2.4rem;
    font-weight: 900;
    color: var(--pp-ink);
    background: linear-gradient(180deg, var(--pp-gold-light), var(--pp-gold-deep));
    animation: pp-entry-pop 0.5s cubic-bezier(0.18, 1.4, 0.4, 1);
}

.pp-event__done-title {
    margin: 0;
    font-size: 1.3rem;
    font-weight: 900;
}

.pp-event__error {
    margin: 0;
    color: var(--pp-danger);
    font-size: 0.9rem;
}

@keyframes pp-entry-glow {
    0%,
    100% {
        box-shadow:
            0 0 0 6px rgba(255, 213, 74, 0.25),
            0 14px 40px rgba(255, 140, 0, 0.45);
    }

    50% {
        box-shadow:
            0 0 0 14px rgba(255, 213, 74, 0.12),
            0 14px 56px rgba(255, 140, 0, 0.7);
    }
}

@keyframes pp-entry-pop {
    0% {
        transform: scale(0.2);
        opacity: 0;
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
