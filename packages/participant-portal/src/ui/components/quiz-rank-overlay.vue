<template>
    <div v-if="shown" class="pp-rank-won" :class="{ 'is-top': isTop, 'is-out': outOfRank }" role="alertdialog" aria-live="assertive"
        aria-label="クイズの順位" data-testid="quiz-my-rank">
        <div v-if="isTop" class="pp-rank-won__confetti" aria-hidden="true">
            <span v-for="n in PIECES" :key="n" class="pp-rank-won__piece" :style="pieceStyle(n)" />
        </div>

        <p class="pp-rank-won__lead">結果発表!</p>

        <template v-if="round && round.me.correct && round.me.rank !== null">
            <p class="pp-rank-won__you">あなたは</p>
            <p class="pp-rank-won__rank" data-testid="quiz-my-rank-text"><strong>{{ round.me.rank }}</strong>位!</p>
            <p class="pp-rank-won__sub">{{ round.me.sec!.toFixed(1) }}秒で正解!</p>
        </template>
        <template v-else-if="round">
            <p class="pp-rank-won__out" data-testid="quiz-my-rank-text">今回は ランク外</p>
            <p class="pp-rank-won__sub" data-testid="quiz-my-rank-sub">{{ round.me.answered ? '残念、不正解でした' : '今回は回答していません' }}</p>
        </template>
        <template v-else-if="failed">
            <p class="pp-rank-won__sub" data-testid="quiz-my-rank-error">順位を読み込めませんでした。</p>
            <button type="button" class="pp-button" @click="load">もう一度読み込む</button>
        </template>
        <p v-else class="pp-rank-won__sub" data-testid="quiz-my-rank-loading" role="status">順位を集計しています…</p>

        <button type="button" class="pp-button pp-button--ghost pp-rank-won__close" data-testid="quiz-my-rank-close" @click="dismissedRound = roundKey">
            とじる
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, onScopeDispose, ref, watch } from 'vue';
import { useQuizContext } from '../../model/use-quiz';
import { useResultsContext } from '../../model/use-results';

const PIECES = 24;
/** 保存が済んでから公開されるので、普通は1回で見つかる。見つからないときの取り直しの回数と間隔。 */
const LOAD_ATTEMPTS = 4;
const LOAD_INTERVAL_MS = 1000;

/** 紙吹雪1枚ごとの落下時間・開始のずれ。CSS には剰余演算子が無いので、ここで計算して CSS 変数として渡す。 */
function pieceStyle(n: number): Record<string, string | number> {
    return {
        '--n': n,
        '--dur': `${2.2 + (n % 5) * 0.35}s`,
        '--delay': `${(n % 7) * -0.4}s`,
    };
}

const quiz = useQuizContext();
const results = useResultsContext();

/** 会場の発表が終わった(1位の発表と結果の保存まで済んだ)回のキー。 */
const roundKey = computed(() => {
    const q = quiz.quiz.value;
    return q && q.page === 'result' && q.reveal === 'finished' ? q.roundKey : null;
});
const dismissedRound = ref<string | null>(null);
const shown = computed(() => roundKey.value !== null && dismissedRound.value !== roundKey.value);

const round = computed(() => {
    const key = roundKey.value;
    return key ? (results.view.value?.quiz.rounds.find((r) => r.roundKey === key) ?? null) : null;
});
const failed = ref(false);
const isTop = computed(() => round.value?.me.correct === true && round.value.me.rank === 1);
const outOfRank = computed(() => !!round.value && !round.value.me.correct);

let disposed = false;
let loadId = 0;
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** この回の結果が見つかるまで取り直す(ホストの保存と公開のずれ、通信の失敗に備える)。 */
async function load(): Promise<void> {
    const id = ++loadId;
    failed.value = false;
    for (let i = 0; i < LOAD_ATTEMPTS; i++) {
        await results.refresh();
        if (disposed || id !== loadId) return;
        if (round.value) return;
        if (i < LOAD_ATTEMPTS - 1) await sleep(LOAD_INTERVAL_MS);
        if (disposed || id !== loadId) return;
    }
    failed.value = !round.value;
}

watch(
    roundKey,
    (key) => {
        if (!key) {
            loadId++;
            failed.value = false;
            return;
        }
        if (dismissedRound.value !== key) void load();
    },
    { immediate: true }
);

watch(shown, (now) => {
    if (!now || !round.value?.me.correct) return;
    try {
        navigator.vibrate?.([200, 100, 200]);
    } catch {
        // 振動できない端末では何もしない
    }
});

onScopeDispose(() => {
    disposed = true;
});
</script>

<style scoped>
.pp-rank-won {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    padding: 24px 16px calc(24px + env(safe-area-inset-bottom));
    text-align: center;
    overflow: hidden auto;
    background: radial-gradient(circle at 50% 35%, #5c1020 0%, var(--pp-ink) 75%);
    animation: pp-rank-in 0.45s cubic-bezier(0.2, 1.3, 0.4, 1) both;
}

.pp-rank-won.is-top {
    background: radial-gradient(circle at 50% 35%, #8a1428 0%, var(--pp-ink) 75%);
}

.pp-rank-won__lead {
    margin: auto 0 0;
    font-size: clamp(1rem, 5vw, 1.4rem);
    font-weight: 800;
    color: var(--pp-gold-light);
}

.pp-rank-won__you {
    margin: 0;
    font-size: clamp(1.4rem, 7vw, 2rem);
    font-weight: 800;
}

.pp-rank-won__rank {
    margin: 0;
    font-size: clamp(2rem, min(12vw, 10vh), 4rem);
    font-weight: 900;
    line-height: 1.1;
    color: var(--pp-gold);
    text-shadow: 0 0 32px rgba(255, 213, 74, 0.7);
    animation: pp-rank-pulse 1s ease-in-out infinite;
}

.pp-rank-won__rank strong {
    /* 横向き(高さが低い)でも収まるよう、幅と高さの小さい方に合わせる */
    font-size: clamp(5rem, min(42vw, 34vh), 11rem);
    font-weight: 900;
    line-height: 1;
}

.pp-rank-won__out {
    margin: 0;
    font-size: clamp(2rem, min(11vw, 9vh), 3.6rem);
    font-weight: 900;
    line-height: 1.2;
    color: var(--pp-text-muted);
}

.pp-rank-won__sub {
    margin: 0;
    font-size: clamp(1rem, 4.5vw, 1.3rem);
    font-weight: 700;
    overflow-wrap: anywhere;
}

.pp-rank-won__close {
    margin: 12px 0 auto;
}

@media (max-height: 480px) {
    .pp-rank-won {
        gap: 6px;
        padding: 12px 16px;
    }

    .pp-rank-won__you {
        display: none;
    }
}

.pp-rank-won__confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.pp-rank-won__piece {
    position: absolute;
    top: -16px;
    left: calc(2% + var(--n) * 3.7%);
    width: 10px;
    height: 16px;
    background: hsl(calc(var(--n) * 47), 90%, 60%);
    animation: pp-rank-fall var(--dur) linear var(--delay) infinite;
}

@keyframes pp-rank-in {
    from {
        transform: scale(0.7);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes pp-rank-pulse {
    50% {
        transform: scale(1.05);
    }
}

@keyframes pp-rank-fall {
    to {
        transform: translateY(110vh) rotate(540deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .pp-rank-won,
    .pp-rank-won__rank {
        animation: none;
    }

    .pp-rank-won__confetti {
        display: none;
    }
}
</style>
