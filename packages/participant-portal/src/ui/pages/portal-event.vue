<template>
    <section class="pp-event">
        <template v-if="session.event.value || hasActivity">
            <template v-if="session.event.value">
                <p class="pp-event__label">イベント発生中!</p>
                <h1 class="pp-event__title" data-testid="event-title">{{ session.event.value.title }}</h1>
            </template>

            <!-- いま進行中のもの（参加者の操作・クイズ・当選者）を、イベントの案内より上に出す -->
            <template v-if="connected">
                <ClientInputs />
                <QuizPanel />
                <JackpotWaiting />
                <JackpotCard />
            </template>

            <!-- エントリーの入口はここ1つ。抽選が始まったら、エントリー済みの人には進行状況と当選結果だけを出す -->
            <article v-if="session.event.value && !quizInProgress && !(entry.isIn.value && jackpotActive)" class="pp-card pp-event__panel">
                <EventEntryCard />
            </article>
        </template>
        <template v-else>
            <h1 class="pp-title" data-testid="event-none">いまイベントは行われていません</h1>
            <p class="pp-muted">イベントが始まると、下の「イベント」タブが光ってお知らせします。このまま画面を開いてお待ちください。</p>
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
import { useQuizContext } from '../../model/use-quiz';
import EventEntryCard from '../components/event-entry-card.vue';
import ClientInputs from '../components/client-inputs.vue';
import JackpotCard from '../components/jackpot-card.vue';
import JackpotWaiting from '../components/jackpot-waiting.vue';
import QuizPanel from '../components/quiz-panel.vue';

const session = usePortalContext();
const entry = useEntryContext();
const quiz = useQuizContext();
const connected = computed(() => session.status.value === 'connected' || session.status.value === 'reconnecting');
const quizActive = computed(() => quiz.quiz.value !== null);
/** 出題・正解発表・結果発表の間は、エントリーの案内を重ねて出さない（イントロとエントリー画面の間は、エントリーできる）。 */
const quizInProgress = computed(() => {
    const page = quiz.quiz.value?.page;
    return page === 'play' || page === 'answer' || page === 'result';
});
/** ホストがジャックポットの状態を公開している(説明・抽選の最中、または結果が出ている)。 */
const jackpotActive = computed(() => readJackpotView(session.state.value.roomState?.data) !== null);
/** 参加者の操作・クイズ・当選者のどれかが出ているか（出ている間は「イベントは行われていません」を出さない）。 */
const hasActivity = computed(
    () => session.clientInputs.value.length > 0 || quizActive.value || jackpotActive.value
);
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
</style>
