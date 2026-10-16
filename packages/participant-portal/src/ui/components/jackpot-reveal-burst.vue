<template>
    <div class="pp-burst" aria-hidden="true" :data-testid="`reveal-burst-${kind}`">
        <span class="pp-burst__flash" />
        <span class="pp-burst__rays" />
        <span v-for="n in PIECES" :key="n" class="pp-burst__piece" :style="{ '--a': `${(n * 360) / PIECES}deg`, '--n': n }" />
    </div>
</template>

<script setup lang="ts">
/**
 * 当選者・賞品が公開された瞬間に、その場で1回だけ弾ける演出(閃光・光線・紙吹雪)。
 * 親が `:key` に当選者名/賞品名を渡して作り直すことで、公開のたびに再生される。
 * 内容より背面に置き、操作は妨げない。動きを減らす設定の端末では出さない。
 */
defineProps<{ kind: 'member' | 'prize' }>();

const PIECES = 18;
</script>

<style scoped>
.pp-burst {
    position: absolute;
    inset: 0;
    z-index: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: inherit;
    pointer-events: none;
}

/* 公開の瞬間の白い閃光 */
.pp-burst__flash {
    position: absolute;
    inset: 0;
    background: radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.9), rgba(255, 213, 74, 0.35) 45%, transparent 75%);
    animation: pp-burst-flash 0.7s ease-out both;
}

/* ゆっくり回る光線。しばらく見せてから消える */
.pp-burst__rays {
    position: absolute;
    inset: 0;
    overflow: hidden;
}

/* 回る光線は疑似要素に持たせ、要素そのものは枠からはみ出さない（画面の端を越える要素を作らない） */
.pp-burst__rays::before {
    content: '';
    position: absolute;
    left: 50%;
    top: 50%;
    width: 220%;
    aspect-ratio: 1 / 1;
    margin: -110% 0 0 -110%;
    background: repeating-conic-gradient(from 0deg, rgba(255, 213, 74, 0.32) 0deg 8deg, transparent 8deg 24deg);
    mask-image: radial-gradient(circle, #000 0%, transparent 60%);
    -webkit-mask-image: radial-gradient(circle, #000 0%, transparent 60%);
    animation: pp-burst-rays 3.2s ease-out both;
}

/* 中心から放射状に飛ぶ紙吹雪 */
.pp-burst__piece {
    position: absolute;
    width: 8px;
    height: 14px;
    border-radius: 2px;
    background: hsl(calc(var(--n) * 47), 90%, 62%);
    --d: calc(70px + (var(--n) % 3) * 38px);
    animation: pp-burst-fly 1.3s cubic-bezier(0.1, 0.8, 0.3, 1) calc((var(--n) % 4) * 0.05s) both;
}

@keyframes pp-burst-flash {
    from {
        opacity: 1;
    }

    to {
        opacity: 0;
    }
}

@keyframes pp-burst-rays {
    0% {
        opacity: 0;
        transform: rotate(0deg) scale(0.4);
    }

    15% {
        opacity: 1;
    }

    100% {
        opacity: 0;
        transform: rotate(50deg) scale(1);
    }
}

@keyframes pp-burst-fly {
    from {
        opacity: 1;
        transform: rotate(var(--a)) translateY(0) scale(1);
    }

    to {
        opacity: 0;
        transform: rotate(var(--a)) translateY(calc(var(--d) * -1)) rotate(300deg) scale(0.5);
    }
}

@media (prefers-reduced-motion: reduce) {
    .pp-burst {
        display: none;
    }
}
</style>
