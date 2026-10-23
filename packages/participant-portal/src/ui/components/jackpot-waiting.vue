<template>
    <section v-if="stage" class="pp-card pp-waiting" :class="`is-${stage.kind}`" data-testid="jackpot-waiting" aria-live="polite">
        <div class="pp-waiting__spinner" aria-hidden="true">
            <span v-for="n in 8" :key="n" class="pp-waiting__dot" :style="{ '--i': n }" />
        </div>
        <p class="pp-waiting__title" data-testid="jackpot-waiting-title">{{ stage.title }}</p>
        <p class="pp-waiting__sub">{{ stage.sub }}</p>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { readJackpotView } from '../../model/activity';
import { useEntryContext } from '../../model/use-entry';
import { useQuizContext } from '../../model/use-quiz';
import { usePortalContext } from '../../model/use-portal-session';

const session = usePortalContext();
const quiz = useQuizContext();
const entry = useEntryContext();

/**
 * ジャックポットの待機画面。ホストが抽選を進めている間、スマホにも「いま何をしているか」を出して場の熱を伝える。
 * 場面(stage)から導く。当選者・賞品が見えている場面(結果は JackpotCard が出す)と、クイズが出ている間は出さない。
 */
const stage = computed(() => {
    const jackpot = readJackpotView(session.state.value.roomState?.data);
    if (!jackpot || quiz.quiz.value) return null;
    switch (jackpot.stage) {
        case 'waiting':
            // エントリーしていない人には「まもなく抽選」を出さない(その人にはエントリーカードを出す)
            if (!entry.isIn.value) return null;
            return { kind: 'ready', title: 'まもなく抽選!', sub: 'このまま画面を開いてお待ちください' };
        case 'member':
            return { kind: 'member', title: 'メンバー抽選中…', sub: '誰に当たるかな? 会場の画面に注目!' };
        case 'prize':
            return { kind: 'prize', title: '景品抽選中…', sub: jackpot.member ? `当選者は ${jackpot.member} さん! 景品は何かな?` : 'どの景品に決まるか、ドキドキ!' };
        default:
            return null;
    }
});
</script>

<style scoped>
.pp-waiting {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    text-align: center;
    border-color: var(--pp-gold);
}

.pp-waiting.is-member,
.pp-waiting.is-prize {
    box-shadow: 0 0 28px rgba(255, 213, 74, 0.28);
    animation: pp-waiting-glow 1.4s ease-in-out infinite;
}

.pp-waiting__spinner {
    position: relative;
    width: 72px;
    height: 72px;
    animation: pp-waiting-spin 2.4s linear infinite;
}

.pp-waiting__dot {
    position: absolute;
    inset: 0;
    transform: rotate(calc(var(--i) * 45deg));
}

.pp-waiting__dot::after {
    content: '';
    position: absolute;
    top: 0;
    left: calc(50% - 5px);
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--pp-gold);
    opacity: calc(var(--i) / 8);
}

.pp-waiting__title {
    margin: 0;
    font-size: clamp(1.4rem, 7vw, 2rem);
    font-weight: 900;
    color: var(--pp-gold);
}

.pp-waiting__sub {
    margin: 0;
    color: var(--pp-text-muted);
    overflow-wrap: anywhere;
}

@keyframes pp-waiting-spin {
    to {
        transform: rotate(360deg);
    }
}

@keyframes pp-waiting-glow {
    50% {
        box-shadow: 0 0 44px rgba(255, 213, 74, 0.5);
    }
}

@media (prefers-reduced-motion: reduce) {
    .pp-waiting,
    .pp-waiting__spinner {
        animation: none;
    }
}
</style>
