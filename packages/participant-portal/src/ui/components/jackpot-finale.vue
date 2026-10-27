<template>
    <section v-if="finale" class="pp-card pp-finale" data-testid="jackpot-finale" aria-live="polite">
        <div class="pp-finale__sparkles" aria-hidden="true">
            <span v-for="n in SPARKLES" :key="n" class="pp-finale__sparkle" :style="sparkleStyle(n)" />
        </div>
        <p class="pp-finale__title" data-testid="jackpot-finale-title">ジャックポット終了!</p>
        <p class="pp-finale__thanks">ご参加ありがとうございました</p>
        <p class="pp-finale__sub">
            当選結果は<RouterLink to="/p/results" class="pp-finale__link" data-testid="jackpot-finale-results">「結果」タブ</RouterLink>で見られます
        </p>
    </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { readJackpotView } from '../../model/activity';
import { usePortalContext } from '../../model/use-portal-session';

const session = usePortalContext();
/** ホストが結果・エンディングの画面を映している間だけ出す、抽選の締めくくりの画面。 */
const finale = computed(() => readJackpotView(session.state.value.roomState?.data)?.page === 'finale');

const SPARKLES = 12;

/** 金色の粒1つごとの位置・大きさ・遅れ(CSS には剰余演算子が無いので、ここで計算して CSS 変数で渡す)。 */
function sparkleStyle(n: number): Record<string, string> {
    return {
        '--x': `${(n * 37) % 100}%`,
        '--size': `${4 + (n % 3) * 2}px`,
        '--delay': `${-(n % 6) * 1.3}s`,
        '--dur': `${7 + (n % 4)}s`,
    };
}
</script>

<style scoped>
.pp-finale {
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding-block: clamp(20px, 6vh, 44px);
    text-align: center;
    border-color: var(--pp-gold);
    background: linear-gradient(160deg, #4a1220, var(--pp-surface));
    animation: pp-finale-glow 4s ease-in-out infinite;
}

.pp-finale__sparkles {
    position: absolute;
    inset: 0;
    overflow: hidden;
    pointer-events: none;
}

/* 下からゆっくり漂い上がって消える金色の粒 */
.pp-finale__sparkle {
    position: absolute;
    left: var(--x);
    bottom: -10px;
    width: var(--size);
    height: var(--size);
    border-radius: 50%;
    background: var(--pp-gold-light, var(--pp-gold));
    box-shadow: 0 0 8px var(--pp-gold);
    opacity: 0;
    animation: pp-finale-rise var(--dur) linear var(--delay) infinite;
}

.pp-finale__title,
.pp-finale__thanks,
.pp-finale__sub {
    position: relative;
    margin: 0;
}

.pp-finale__title {
    font-size: clamp(1.5rem, 7.5vw, 2.1rem);
    font-weight: 900;
    color: var(--pp-gold);
    text-shadow: 0 0 18px rgba(255, 213, 74, 0.5);
}

.pp-finale__thanks {
    font-size: 1.1rem;
    font-weight: 700;
}

.pp-finale__sub {
    color: var(--pp-text-muted);
    overflow-wrap: anywhere;
}

.pp-finale__link {
    color: var(--pp-gold-light, var(--pp-gold));
    font-weight: 700;
}

@keyframes pp-finale-rise {
    0% {
        transform: translateY(0);
        opacity: 0;
    }
    15% {
        opacity: 0.9;
    }
    100% {
        transform: translateY(-260px);
        opacity: 0;
    }
}

@keyframes pp-finale-glow {
    50% {
        box-shadow: 0 0 36px rgba(255, 213, 74, 0.4);
    }
}

/* 横向きなど縦が短い画面でも、縦にスクロールさせず収める */
@media (max-height: 500px) {
    .pp-finale {
        gap: 2px;
        padding-block: 8px;
    }

    .pp-finale__title {
        font-size: 1.4rem;
    }

    .pp-finale__thanks {
        font-size: 1rem;
    }
}

@media (prefers-reduced-motion: reduce) {
    .pp-finale {
        animation: none;
        box-shadow: 0 0 24px rgba(255, 213, 74, 0.28);
    }

    .pp-finale__sparkle {
        animation: none;
        opacity: 0.5;
        bottom: auto;
        top: calc(var(--delay) * -10px);
    }
}
</style>
