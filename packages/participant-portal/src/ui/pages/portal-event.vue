<template>
    <section class="pp-event">
        <template v-if="session.event.value">
            <p class="pp-event__label">イベント発生中!</p>
            <h1 class="pp-event__title" data-testid="event-title">{{ session.event.value.title }}</h1>
            <article class="pp-card">
                <p class="pp-muted">イベントが進行中です。この画面を開いたままお待ちください。</p>
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
import { RouterLink } from 'vue-router';
import { usePortalContext } from '../../model/use-portal-session';

const session = usePortalContext();
</script>

<style scoped>
.pp-event {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
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
    word-break: break-word;
    color: var(--pp-gold-light);
    text-shadow: 0 0 22px rgba(255, 213, 74, 0.45);
}
</style>
