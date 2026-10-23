<template>
    <div class="pp-entry" :class="[`is-${state}`, `is-${size}`]" :data-state="state" data-testid="event-entry-card">
        <!-- 受付前: 待つだけ -->
        <p v-if="state === 'wait'" class="pp-entry__text" data-testid="entry-none">
            お待ちください
            <span v-if="size === 'full'" class="pp-muted pp-entry__hint">エントリーの受付は、このあと始まります。この画面を開いたままお待ちください。</span>
        </p>

        <!-- エントリー済み、または自動エントリー -->
        <div v-else-if="state === 'done'" class="pp-entry__done" data-testid="entry-done">
            <span v-if="size === 'full'" class="pp-entry__check" aria-hidden="true">✓</span>
            <span class="pp-entry__text">エントリー済み ✓</span>
            <span v-if="size === 'full'" class="pp-muted">
                {{ entry.phase.value === 'closed' ? '受付は終了しました。結果をお待ちください。' : '会場の画面に表示されます。このままお待ちください。' }}
            </span>
        </div>

        <!-- 受付中: 押したらその場でエントリー（別の画面へは移らない） -->
        <div v-else-if="state === 'open'" class="pp-entry__open" data-testid="entry-open">
            <button type="button" class="pp-entry__button" :disabled="entry.submitting.value" data-testid="entry-button" @click="entry.enter">
                <span class="pp-entry__main">{{ entry.submitting.value ? '送信中…' : 'エントリーする' }}</span>
                <span v-if="size === 'full'" class="pp-entry__sub">タップするだけで参加できます</span>
            </button>
            <p v-if="size === 'full'" class="pp-muted">押すと、会場の画面にあなたが表示されます。</p>
        </div>

        <!-- 締切後（エントリーしていない人） -->
        <p v-else class="pp-entry__text" data-testid="entry-closed">
            受付終了
            <span v-if="size === 'full'" class="pp-muted pp-entry__hint">{{ entry.message.value || '次の機会をお待ちください。' }}</span>
        </p>

        <p v-if="entry.message.value && state === 'open'" class="pp-entry__error" role="alert" data-testid="entry-error">{{ entry.message.value }}</p>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useEntryContext } from '../../model/use-entry';

withDefaults(defineProps<{ size?: 'full' | 'compact' }>(), { size: 'full' });

const entry = useEntryContext();

/** 受付の状態は useEntry() の1か所から導く。 */
const state = computed<'wait' | 'open' | 'done' | 'closed'>(() => {
    if (entry.isIn.value) return 'done';
    switch (entry.phase.value) {
        case 'none':
            return 'wait';
        case 'open':
            return 'open';
        default:
            return 'closed';
    }
});
</script>

<style scoped>
.pp-entry {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.pp-entry.is-full {
    align-items: center;
    text-align: center;
}

.pp-entry__text {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 0;
    font-size: 1.2rem;
    font-weight: 900;
}

.is-compact .pp-entry__text {
    font-size: 1rem;
    white-space: nowrap;
}

.pp-entry.is-done .pp-entry__text {
    color: var(--pp-ok);
}

.pp-entry__done {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
}

.is-compact .pp-entry__done {
    flex-direction: row;
}

.pp-entry__check {
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

.pp-entry__open {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 4px 0;
}

/* 親指で押しやすい大きなボタン。ゆっくり光って「押してほしい」ことが分かるようにする */
.pp-entry__button {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border: 0;
    font: inherit;
    color: var(--pp-ink);
    background: radial-gradient(circle at 35% 28%, var(--pp-gold-light), var(--pp-gold) 45%, var(--pp-gold-deep));
    cursor: pointer;
    animation: pp-entry-glow 1.8s ease-in-out infinite;
}

.is-full .pp-entry__button {
    width: min(100%, 260px);
    aspect-ratio: 1 / 1;
    border-radius: 50%;
    box-shadow:
        0 0 0 6px rgba(255, 213, 74, 0.25),
        0 14px 40px rgba(255, 140, 0, 0.45);
}

.is-compact .pp-entry__button {
    min-width: 132px;
    min-height: 48px;
    padding: 8px 18px;
    border-radius: 999px;
}

.pp-entry__button:active {
    transform: scale(0.97);
}

.pp-entry__button:disabled {
    opacity: 0.7;
    animation: none;
    cursor: default;
}

.pp-entry__main {
    font-size: 1.1rem;
    font-weight: 900;
    letter-spacing: 0.06em;
}

.is-full .pp-entry__main {
    font-size: 1.8rem;
}

.pp-entry__sub {
    font-size: 0.85rem;
    font-weight: 700;
}

.pp-entry__hint {
    font-size: 0.9rem;
    font-weight: 400;
}

.pp-entry__error {
    margin: 0;
    color: var(--pp-danger);
    font-size: 0.9rem;
}

@keyframes pp-entry-glow {
    0%,
    100% {
        filter: brightness(1);
    }

    50% {
        filter: brightness(1.15);
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

@media (prefers-reduced-motion: reduce) {
    .pp-entry__button,
    .pp-entry__check {
        animation: none;
    }
}
</style>
