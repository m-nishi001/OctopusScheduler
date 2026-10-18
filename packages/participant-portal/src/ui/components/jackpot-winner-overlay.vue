<template>
    <div v-if="won && !dismissed" class="pp-won" role="alertdialog" aria-live="assertive" aria-label="当選しました" data-testid="you-won">
        <div class="pp-won__confetti" aria-hidden="true">
            <span v-for="n in 24" :key="n" class="pp-won__piece" :style="{ '--n': n }" />
        </div>
        <p class="pp-won__lead">おめでとうございます!</p>
        <p class="pp-won__title">あなたが<br />あたりました!</p>
        <p class="pp-won__name" data-testid="you-won-name">{{ jackpot?.member }} さん</p>
        <p class="pp-won__hint">会場の画面に注目!</p>
        <button type="button" class="pp-button pp-won__close" data-testid="you-won-close" @click="dismissed = true">とじる</button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { readJackpotView } from '../../model/activity';
import { useParticipantAuth } from '../../model/participant-auth';
import { usePortalContext } from '../../model/use-portal-session';

const session = usePortalContext();
const auth = useParticipantAuth();

const jackpot = computed(() => readJackpotView(session.state.value.roomState?.data));
/**
 * 自分が当選したことが見えている間(場面が member-revealed のとき)。景品抽選に進んだら、場面が変わって自動で閉じる。
 * 当選者は停止演出が終わるまで公開されないので、先にネタバレしない。
 */
const won = computed(() => {
    const id = auth.currentMember.value?.id;
    return !!id && jackpot.value?.stage === 'member-revealed' && !!jackpot.value.member && jackpot.value.memberId === id;
});

/** 手動で閉じたか。当選の場面が終われば戻し、次の抽選でまた当たったとき表示し直す。 */
const dismissed = ref(false);
watch(won, (now) => {
    if (!now) {
        dismissed.value = false;
        return;
    }
    // 出た瞬間に振動で知らせる
    try {
        navigator.vibrate?.([200, 100, 200, 100, 400]);
    } catch {
        // 振動できない端末では何もしない
    }
});
</script>

<style scoped>
.pp-won {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 12px;
    padding: 24px 16px;
    text-align: center;
    overflow: hidden auto;
    background: radial-gradient(circle at 50% 35%, #8a1428 0%, var(--pp-ink) 75%);
    animation: pp-won-in 0.45s cubic-bezier(0.2, 1.3, 0.4, 1) both;
}

/* 内容が画面より高いときも、上が切れず(スクロールで全部見える)、足りているときは中央に寄せる */
.pp-won__lead {
    margin: auto 0 0;
    font-size: clamp(1rem, 5vw, 1.4rem);
    font-weight: 800;
    color: var(--pp-gold-light);
}

.pp-won__title {
    margin: 0;
    /* 横向き(高さが低い)でも収まるよう、幅と高さの小さい方に合わせる */
    font-size: clamp(2rem, min(14vw, 12vh), 5rem);
    line-height: 1.15;
    font-weight: 900;
    color: var(--pp-gold);
    text-shadow: 0 0 32px rgba(255, 213, 74, 0.7);
    animation: pp-won-pulse 1s ease-in-out infinite;
}

.pp-won__name {
    margin: 0;
    font-size: clamp(1.2rem, 6vw, 1.8rem);
    font-weight: 800;
    overflow-wrap: anywhere;
    max-width: 100%;
}

.pp-won__hint {
    margin: 0 0 8px;
    color: var(--pp-text-muted);
}

.pp-won__close {
    margin-bottom: auto;
}

/* 高さの低い画面(スマホの横向き): 1画面に収めるため詰める */
@media (max-height: 480px) {
    .pp-won {
        gap: 6px;
        padding: 12px 16px;
    }

    .pp-won__title br,
    .pp-won__hint {
        display: none;
    }

    .pp-won__name {
        font-size: 1.1rem;
    }
}

.pp-won__confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
}

.pp-won__piece {
    position: absolute;
    top: -16px;
    left: calc(2% + var(--n) * 3.7%);
    width: 10px;
    height: 16px;
    background: hsl(calc(var(--n) * 47), 90%, 60%);
    animation: pp-won-fall calc(2.2s + (var(--n) % 5) * 0.35s) linear calc((var(--n) % 7) * -0.4s) infinite;
}

@keyframes pp-won-in {
    from {
        transform: scale(0.7);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes pp-won-pulse {
    50% {
        transform: scale(1.06);
    }
}

@keyframes pp-won-fall {
    to {
        transform: translateY(110vh) rotate(540deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .pp-won,
    .pp-won__title {
        animation: none;
    }

    .pp-won__confetti {
        display: none;
    }
}
</style>
