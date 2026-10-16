<template>
    <section v-if="jackpot && (jackpot.member || jackpot.prize)" class="pp-card pp-jackpot" data-testid="winner" aria-live="polite">
        <p class="pp-jackpot__label">ジャックポット</p>
        <!-- 公開されるたびに作り直して、その場で弾ける演出を1回再生する -->
        <div v-if="jackpot.member" :key="`m:${jackpot.member}`" class="pp-jackpot__reveal">
            <JackpotRevealBurst kind="member" />
            <p class="pp-jackpot__member" data-testid="winner-member">
                <span class="pp-jackpot__tag">当選者:</span> <strong class="pp-jackpot__member-name">{{ jackpot.member }}</strong>
            </p>
        </div>
        <!-- 会場の画面が小さくても見えるよう、賞品は画面いっぱいに大きく出す -->
        <div v-if="jackpot.prize" :key="`p:${jackpot.prize}`" class="pp-jackpot__reveal">
            <JackpotRevealBurst kind="prize" />
            <div class="pp-jackpot__prize" data-testid="winner-prize">
                <span class="pp-jackpot__tag">賞品:</span>
                <strong class="pp-jackpot__prize-name">{{ jackpot.prize }}</strong>
            </div>
        </div>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { readJackpotView } from '../../model/activity';
import { usePortalContext } from '../../model/use-portal-session';
import JackpotRevealBurst from './jackpot-reveal-burst.vue';

const session = usePortalContext();
/** 当選者・賞品は、ホストの停止演出が終わるまで公開されない（先にネタバレしない）。 */
const jackpot = computed(() => readJackpotView(session.state.value.roomState?.data));
</script>

<style scoped>
.pp-jackpot {
    border-color: var(--pp-gold);
    box-shadow: 0 0 28px rgba(255, 213, 74, 0.28);
    background: linear-gradient(160deg, #4a1220, var(--pp-surface));
    text-align: center;
}

.pp-jackpot__label {
    margin: 0 0 6px;
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    color: var(--pp-gold);
}

.pp-jackpot__tag {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--pp-text-muted);
}

.pp-jackpot__reveal {
    position: relative;
    padding: 6px 0;
}

/* 演出は背面に置き、文字は常に前面に出す */
.pp-jackpot__member,
.pp-jackpot__prize {
    position: relative;
    z-index: 1;
}

.pp-jackpot__member {
    margin: 4px 0;
    font-size: 1.25rem;
    overflow-wrap: anywhere;
}

.pp-jackpot__member-name {
    display: inline-block;
    color: var(--pp-gold-light);
    font-size: 1.5rem;
    text-shadow: 0 0 20px rgba(255, 213, 74, 0.6);
    animation: pp-member-in 0.8s cubic-bezier(0.2, 1.5, 0.4, 1) both;
}

.pp-jackpot__prize {
    margin: 10px 0 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    animation: pp-prize-pop 0.9s cubic-bezier(0.2, 1.4, 0.4, 1) 0.15s both;
}

.pp-jackpot__prize-name {
    /* 狭い画面でも1〜2行に収まり、広い画面でも大きすぎない */
    font-size: clamp(2.2rem, 12vw, 4.5rem);
    line-height: 1.15;
    font-weight: 900;
    color: var(--pp-gold);
    text-shadow: 0 0 24px rgba(255, 213, 74, 0.55);
    overflow-wrap: anywhere;
}

@keyframes pp-member-in {
    0% {
        transform: scale(2.4);
        opacity: 0;
        filter: blur(8px);
    }

    60% {
        transform: scale(0.92);
        opacity: 1;
        filter: blur(0);
    }

    100% {
        transform: scale(1);
    }
}

@keyframes pp-prize-pop {
    from {
        transform: scale(0.6);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

@media (prefers-reduced-motion: reduce) {
    .pp-jackpot__prize,
    .pp-jackpot__member-name {
        animation: none;
    }
}
</style>
