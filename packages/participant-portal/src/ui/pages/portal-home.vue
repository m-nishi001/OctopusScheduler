<template>
    <section class="pp-home">
        <h1 class="pp-title" data-testid="home-greeting">
            <template v-if="auth.currentMember.value">{{ auth.currentMember.value.name }} さん、ようこそ</template>
            <template v-else>ようこそ</template>
        </h1>

        <!-- いま進行中のもの（参加者の操作・クイズ・当選者）を、いちばん上に出す -->
        <template v-if="connected">
            <ClientInputs />
            <QuizPanel />
            <JackpotCard />
        </template>

        <article v-if="connected && (session.event.value || !hasActivity)" class="pp-card pp-home__card"
            :class="{ 'is-live': !!session.event.value }" data-testid="home-status">
            <template v-if="session.event.value">
                <p class="pp-home__live">イベント発生中!</p>
                <p class="pp-home__event-title" data-testid="home-event-title">{{ session.event.value.title }}</p>
                <p v-if="entry.phase.value === 'open' && !entry.entered.value" class="pp-home__entry" data-testid="home-entry-open">エントリー受付中!</p>
                <p v-else-if="entry.entered.value" class="pp-home__entry is-done" data-testid="home-entry-done">エントリー済み ✓</p>
                <RouterLink to="/p/event" class="pp-button" data-testid="home-join">
                    {{ entry.phase.value === 'open' && !entry.entered.value ? 'エントリーする' : '参加する' }}
                </RouterLink>
            </template>
            <template v-else>
                <p class="pp-home__idle-title">いまイベントは行われていません</p>
                <p class="pp-muted">イベントが始まると、画面の上に「イベント発生中!」が表示されます。このまま画面を開いてお待ちください。</p>
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
import { RouterLink } from 'vue-router';
import { useParticipantAuth } from '../../model/participant-auth';
import { readJackpotView } from '../../model/activity';
import { useEntryContext } from '../../model/use-entry';
import { useQuizContext } from '../../model/use-quiz';
import ClientInputs from '../components/client-inputs.vue';
import JackpotCard from '../components/jackpot-card.vue';
import QuizPanel from '../components/quiz-panel.vue';
import { usePortalContext } from '../../model/use-portal-session';

const auth = useParticipantAuth();
const session = usePortalContext();
const entry = useEntryContext();
const quiz = useQuizContext();

const connected = computed(() => session.status.value === 'connected' || session.status.value === 'reconnecting');
/** 参加者の操作・クイズ・当選者のどれかが出ているか（出ている間は「イベントは行われていません」を出さない）。 */
const hasActivity = computed(() => {
    const data = session.state.value.roomState?.data;
    const jackpot = readJackpotView(data);
    return (
        (session.state.value.roomState?.clientInput.length ?? 0) > 0 ||
        quiz.quiz.value !== null ||
        !!(jackpot && (jackpot.member || jackpot.prize))
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
    word-break: break-word;
}

.pp-home__entry {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 900;
    color: var(--pp-gold);
}

.pp-home__entry.is-done {
    color: var(--pp-ok);
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
