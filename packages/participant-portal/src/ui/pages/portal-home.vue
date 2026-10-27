<template>
    <section class="pp-home">
        <h1 class="pp-title" data-testid="home-greeting">
            <template v-if="auth.currentMember.value">{{ auth.currentMember.value.name }} さん、ようこそ</template>
            <template v-else>ようこそ</template>
        </h1>

        <article v-if="connected" class="pp-card pp-home__card"
            :class="{ 'is-live': !!session.event.value || hasActivity }" data-testid="home-status">
            <template v-if="session.event.value && !jackpotFinale">
                <p class="pp-home__live">イベント発生中!</p>
                <p class="pp-home__event-title" data-testid="home-event-title">{{ session.event.value.title }}</p>
                <EventEntryCard class="pp-home__entry-card" />
            </template>
            <template v-else-if="hasActivity">
                <p class="pp-home__live">進行中です!</p>
                <p class="pp-home__entry">{{ jackpotFinale ? 'ジャックポットが終了しました。当選結果は「結果」タブで見られます' : 'クイズや抽選が行われています' }}</p>
            </template>
            <template v-else>
                <p class="pp-home__idle-title">いまイベントは行われていません</p>
                <p class="pp-muted">イベントが始まると、画面の上に「イベント発生中!」が表示され、下の「イベント」タブが光ります。このまま画面を開いてお待ちください。</p>
            </template>
            <p class="pp-muted pp-home__count" data-testid="home-count">会場の参加者 {{ session.clientCount.value }} 人</p>
        </article>

        <article v-else-if="!connected" class="pp-card pp-home__card" data-testid="home-status">
            <p class="pp-home__idle-title">{{ session.message.value }}</p>
            <button v-if="canRetry" type="button" class="pp-button" :disabled="retrying" data-testid="home-retry" @click="retry">
                つなぎ直す
            </button>
        </article>

    </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import EventEntryCard from '../components/event-entry-card.vue';
import { useParticipantAuth } from '../../model/participant-auth';
import { readJackpotView } from '../../model/activity';
import { useQuizContext } from '../../model/use-quiz';
import { usePortalContext } from '../../model/use-portal-session';

const auth = useParticipantAuth();
const session = usePortalContext();
const quiz = useQuizContext();

const connected = computed(() => session.status.value === 'connected' || session.status.value === 'reconnecting');
/** ホストが結果・エンディングの画面を映している(エントリーのカードは出さない)。 */
const jackpotFinale = computed(() => readJackpotView(session.state.value.roomState?.data)?.page === 'finale');
/** 参加者の操作・クイズ・当選者のどれかが出ているか（出ている間は「イベントは行われていません」を出さない）。 */
const hasActivity = computed(() => {
    const data = session.state.value.roomState?.data;
    const jackpot = readJackpotView(data);
    return (
        session.clientInputs.value.length > 0 ||
        quiz.quiz.value !== null ||
        jackpot !== null
    );
});

const retrying = ref(false);
const canRetry = computed(() => session.status.value !== 'joining');

async function retry() {
    if (retrying.value) return;
    retrying.value = true;
    try {
        await session.join();
    } finally {
        retrying.value = false;
    }
}
</script>

<style scoped>
.pp-home {
    display: flex;
    flex-direction: column;
    gap: 16px;
}

.pp-home__card {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
}

.pp-home__card.is-live {
    border-color: var(--pp-gold);
    box-shadow: 0 0 28px rgba(255, 213, 74, 0.25);
}

.pp-home__live {
    margin: 0;
    font-size: 0.85rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--pp-gold);
}

.pp-home__event-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 900;
    line-height: 1.3;
}

.pp-home__entry {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 900;
    color: var(--pp-gold);
}

.pp-home__entry-card {
    align-self: stretch;
}

.pp-home__idle-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 700;
}

.pp-home__count {
    font-size: 0.8rem;
}
</style>
