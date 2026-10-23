<template>
    <section class="pp-results" data-testid="results-page">
        <h1 class="pp-title">結果</h1>

        <!-- 自分の成績。クイズでの累計順位と、ジャックポットの当選回数 -->
        <article v-if="view && ((!held && view.quiz.cumulative.me) || view.jackpot.myWins > 0)" class="pp-card pp-results__me" data-testid="results-me">
            <p class="pp-results__label">あなたの成績</p>
            <p v-if="!held && view.quiz.cumulative.me" class="pp-results__big" data-testid="results-my-rank">
                クイズ <strong>{{ view.quiz.cumulative.me.rank }}</strong> 位 <span class="pp-muted">/ {{ view.quiz.cumulative.participants }} 人中（{{ view.quiz.cumulative.me.points }} 問正解）</span>
            </p>
            <p v-if="view.jackpot.myWins > 0" class="pp-results__big is-win" data-testid="results-my-wins">
                ジャックポット当選 <strong>{{ view.jackpot.myWins }}</strong> 回 🎉
            </p>
        </article>

        <div v-if="connectedError" class="pp-card" role="alert" data-testid="results-error">
            <p class="pp-muted">結果を読み込めませんでした。電波の良い場所で、もう一度お試しください。</p>
            <button type="button" class="pp-button" :disabled="results.loading.value" @click="results.refresh()">再読み込み</button>
        </div>

        <p v-else-if="!view" class="pp-muted pp-results__loading" data-testid="results-loading" role="status">読み込み中…</p>

        <template v-else>
            <div class="pp-seg" role="tablist" aria-label="結果の種類">
                <button v-for="t in kinds" :key="t.id" type="button" role="tab" class="pp-seg__item" :class="{ 'is-active': kind === t.id }"
                    :aria-selected="kind === t.id" :data-testid="`results-tab-${t.id}`" @click="kind = t.id">
                    {{ t.label }}<span class="pp-seg__count">{{ t.count }}</span>
                </button>
            </div>

            <!-- クイズ -->
            <div v-if="kind === 'quiz'" role="tabpanel" data-testid="results-quiz">
                <!-- 順位発表の途中は、会場の発表が終わるまでクイズの結果(この回の順位も総合も)を伏せる -->
                <p v-if="held" class="pp-card pp-muted" data-testid="results-quiz-held">
                    結果発表中です。会場の画面をご覧ください。発表が終わると、ここに順位が表示されます。
                </p>
                <p v-else-if="view.quiz.rounds.length === 0" class="pp-card pp-muted" data-testid="results-quiz-empty">
                    まだクイズの結果はありません。クイズの結果発表のあとに、ここに順位が表示されます。
                </p>
                <template v-else>
                    <article class="pp-card pp-results__block" data-testid="results-cumulative">
                        <h2 class="pp-results__h">総合ランキング</h2>
                        <p class="pp-muted">正解数が多い順。同じ正解数なら、回答が早かった人が上位です。</p>
                        <ol class="pp-rank">
                            <li v-for="row in view.quiz.cumulative.top" :key="row.rank" class="pp-rank__row" :class="{ 'is-mine': row.mine }"
                                :data-testid="row.mine ? 'results-cumulative-mine' : undefined">
                                <span class="pp-rank__no" :class="`is-r${Math.min(row.rank, 4)}`">{{ row.rank }}</span>
                                <span class="pp-rank__name">{{ row.name }}<em v-if="row.mine" class="pp-rank__badge">あなた</em></span>
                                <span class="pp-rank__val">{{ row.points }}問</span>
                                <span class="pp-rank__sub">{{ row.totalSec.toFixed(1) }}秒</span>
                            </li>
                        </ol>
                        <p v-if="myCumulativeOutside" class="pp-rank__outside" data-testid="results-cumulative-outside">
                            あなた: {{ view.quiz.cumulative.me!.rank }}位（{{ view.quiz.cumulative.me!.points }}問 / {{ view.quiz.cumulative.me!.totalSec.toFixed(1) }}秒）
                        </p>
                    </article>

                    <h2 class="pp-results__h pp-results__h--list">各問の結果</h2>
                    <article v-for="round in view.quiz.rounds" :key="round.roundKey" class="pp-card pp-results__block" data-testid="results-round">
                        <header class="pp-round__head">
                            <h3 class="pp-round__title">{{ round.title }}</h3>
                            <span class="pp-badge" :class="verdictClass(round)" data-testid="results-round-verdict">{{ verdictText(round) }}</span>
                        </header>
                        <p class="pp-muted">回答 {{ round.answeredCount }} 人 / 正解 {{ round.correctCount }} 人 ・ {{ clock(round.closedAtMs) }}</p>
                        <ol v-if="round.top.length" class="pp-rank">
                            <li v-for="row in round.top" :key="row.rank" class="pp-rank__row" :class="{ 'is-mine': row.mine }">
                                <span class="pp-rank__no" :class="`is-r${Math.min(row.rank, 4)}`">{{ row.rank }}</span>
                                <span class="pp-rank__name">{{ row.name }}<em v-if="row.mine" class="pp-rank__badge">あなた</em></span>
                                <span class="pp-rank__val">{{ row.sec.toFixed(1) }}秒</span>
                            </li>
                        </ol>
                        <p v-else class="pp-muted">正解者はいませんでした。</p>
                        <p v-if="round.me.correct && round.me.rank !== null && round.me.rank > round.top.length" class="pp-rank__outside">
                            あなた: {{ round.me.rank }}位（{{ round.me.sec!.toFixed(1) }}秒）
                        </p>
                    </article>
                </template>
            </div>

            <!-- ジャックポット -->
            <div v-else role="tabpanel" data-testid="results-jackpot">
                <p v-if="view.jackpot.draws.length === 0" class="pp-card pp-muted" data-testid="results-jackpot-empty">
                    まだ当選者はいません。ジャックポットの抽選のあとに、当選履歴がここに表示されます。
                </p>
                <ol v-else class="pp-wins">
                    <li v-for="d in view.jackpot.draws" :key="d.drawId" class="pp-card pp-wins__item" :class="{ 'is-mine': d.mine }" data-testid="results-draw">
                        <p class="pp-wins__prize">{{ d.prizeName }}<span v-if="d.isKakuhen" class="pp-badge is-kakuhen">確変</span></p>
                        <p class="pp-wins__who">{{ d.memberName }} さん<em v-if="d.mine" class="pp-rank__badge" data-testid="results-draw-mine">あなたが当選!</em></p>
                        <p class="pp-muted">{{ clock(d.atMs) }}</p>
                    </li>
                </ol>
            </div>

            <p class="pp-results__foot pp-muted" aria-live="polite">
                <template v-if="results.loading.value">更新中…</template>
                <template v-else-if="results.stale.value">新しい結果があります <button type="button" class="pp-link" @click="results.refresh()">更新する</button></template>
                <template v-else>最新の結果です</template>
            </p>
        </template>
    </section>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import type { QuizRoundView } from '@octopus/session-hub';
import { useResultsContext } from '../../model/use-results';

const results = useResultsContext();
const view = computed(() => results.view.value);
const held = results.held;
/** 取得に失敗していて、表示できる結果もまだ無い。 */
const connectedError = computed(() => results.error.value && !view.value);

onMounted(() => results.setVisible(true));
onUnmounted(() => results.setVisible(false));

const kind = ref<'quiz' | 'jackpot'>('quiz');
const kinds = computed(() => [
    { id: 'quiz' as const, label: 'クイズ', count: held.value ? '-' : (view.value?.quiz.rounds.length ?? 0) },
    { id: 'jackpot' as const, label: 'ジャックポット', count: view.value?.jackpot.draws.length ?? 0 },
]);
// 初めて結果が届いたとき、クイズの結果が無くてジャックポットだけあるなら、そちらを先に見せる(最初の1回だけ)
let decidedFirst = false;
watch(
    view,
    (loaded) => {
        if (!loaded || decidedFirst) return;
        decidedFirst = true;
        if (loaded.quiz.rounds.length === 0 && loaded.jackpot.draws.length > 0) kind.value = 'jackpot';
    },
    { immediate: true }
);

/** 総合ランキングの上位に入っていない自分の順位を、表の下に出す。 */
const myCumulativeOutside = computed(() => {
    const c = view.value?.quiz.cumulative;
    return !!c?.me && !c.top.some((r) => r.mine);
});

function verdictText(round: QuizRoundView): string {
    if (!round.me.answered) return '未回答';
    return round.me.correct ? `正解 ${round.me.rank}位` : '不正解';
}
function verdictClass(round: QuizRoundView): string {
    if (!round.me.answered) return 'is-none';
    return round.me.correct ? 'is-ok' : 'is-ng';
}

function clock(ms: number): string {
    const d = new Date(ms);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
</script>

<style scoped>
.pp-results {
    display: flex;
    flex-direction: column;
    gap: 14px;
}

.pp-results__label {
    margin: 0 0 6px;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--pp-gold);
}

.pp-results__me {
    border-color: var(--pp-gold);
    background: linear-gradient(160deg, #4a1220, var(--pp-surface));
}

.pp-results__big {
    margin: 4px 0;
    font-size: 1.1rem;
}

.pp-results__big strong {
    font-size: 1.7rem;
    color: var(--pp-gold-light);
}

.pp-results__big.is-win strong {
    color: var(--pp-gold);
}

.pp-results__loading,
.pp-results__foot {
    text-align: center;
}

.pp-results__block {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
}

.pp-results__h {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--pp-gold);
}

.pp-results__h--list {
    margin: 18px 0 10px;
}

/* 種類の切り替え(タブ)。タップしやすい高さ */
.pp-seg {
    display: flex;
    gap: 6px;
    padding: 4px;
    border: 1px solid var(--pp-line);
    border-radius: 999px;
}

.pp-seg__item {
    flex: 1;
    min-height: 44px;
    border: 0;
    border-radius: 999px;
    font: inherit;
    font-weight: 800;
    color: var(--pp-text-muted);
    background: transparent;
    cursor: pointer;
}

.pp-seg__item.is-active {
    color: var(--pp-ink);
    background: linear-gradient(180deg, var(--pp-gold-light), var(--pp-gold));
}

.pp-seg__count {
    margin-left: 6px;
    font-size: 0.8em;
    opacity: 0.8;
}

.pp-rank {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.pp-rank__row {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto auto;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    padding: 6px 10px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.04);
}

.pp-rank__row.is-mine {
    background: rgba(255, 213, 74, 0.18);
    outline: 1.5px solid var(--pp-gold);
}

.pp-rank__no {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 50%;
    font-weight: 900;
    color: var(--pp-text);
    background: rgba(255, 255, 255, 0.12);
}

.pp-rank__no.is-r1 {
    color: var(--pp-ink);
    background: linear-gradient(180deg, #fff2b0, #ffd54a);
}

.pp-rank__no.is-r2 {
    color: var(--pp-ink);
    background: linear-gradient(180deg, #f5f5f5, #b8bcc4);
}

.pp-rank__no.is-r3 {
    color: var(--pp-ink);
    background: linear-gradient(180deg, #f6c9a0, #c47a3a);
}

.pp-rank__name {
    font-weight: 700;
}

.pp-rank__badge {
    margin-left: 8px;
    padding: 2px 8px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-style: normal;
    font-weight: 900;
    color: var(--pp-ink);
    background: var(--pp-gold);
    white-space: nowrap;
}

.pp-rank__val {
    font-weight: 800;
    color: var(--pp-gold-light);
}

.pp-rank__sub {
    font-size: 0.8rem;
    color: var(--pp-text-muted);
}

.pp-rank__outside {
    margin: 4px 0 0;
    padding: 8px 12px;
    border-radius: 12px;
    font-weight: 700;
    background: rgba(255, 213, 74, 0.18);
    outline: 1.5px solid var(--pp-gold);
}

.pp-round__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
}

.pp-round__title {
    margin: 0;
    font-size: 1.05rem;
}

.pp-badge {
    flex: none;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 900;
    background: rgba(255, 255, 255, 0.14);
}

.pp-badge.is-ok {
    color: var(--pp-ink);
    background: var(--pp-ok);
}

.pp-badge.is-ng {
    color: var(--pp-ink);
    background: var(--pp-danger);
}

.pp-badge.is-kakuhen {
    margin-left: 8px;
    color: var(--pp-ink);
    background: var(--pp-gold);
}

.pp-wins {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.pp-wins__item {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.pp-wins__item.is-mine {
    border-color: var(--pp-gold);
    box-shadow: 0 0 24px rgba(255, 213, 74, 0.3);
    background: linear-gradient(160deg, #4a1220, var(--pp-surface));
}

.pp-wins__prize {
    margin: 0;
    font-size: 1.15rem;
    font-weight: 900;
    color: var(--pp-gold-light);
}

.pp-wins__who {
    margin: 0;
    font-size: 1.05rem;
}

.pp-link {
    padding: 0 4px;
    border: 0;
    font: inherit;
    font-weight: 800;
    color: var(--pp-gold);
    background: none;
    text-decoration: underline;
    cursor: pointer;
}
</style>
