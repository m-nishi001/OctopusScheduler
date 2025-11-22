<template>
    <div v-if="visible" class="kakuhen-overlay-root" aria-hidden="true">
        <div class="kakuhen-dim" />
        <div class="kakuhen-content">
            <div class="kakuhen-text" role="presentation">
                <span class="char char-1">だ</span><span class="char char-2">が</span>
            </div>
            <div class="kakuhen-ripple" />
        </div>
    </div>
</template>

<script lang="ts">
export default {
    name: 'KakuhenOverlay',
    props: {
        visible: {
            type: Boolean,
            required: true,
        },
    },
};
</script>

<style>
:root {
    --k-text-color: #ff3232;
    --k-glow: 0 0 40px rgba(255, 50, 50, 0.85);
}

.kakuhen-overlay-root {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 20000;
    pointer-events: none;
}

.kakuhen-dim {
    position: absolute;
    inset: 0;
    background: #000;
    opacity: 0.0;
    animation: dimIn 240ms ease-out forwards;
}

.kakuhen-content {
    position: relative;
    pointer-events: none;
    display: flex;
    align-items: center;
    justify-content: center;
}

.kakuhen-text {
    font-family: 'Noto Sans JP', system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', 'Hiragino Kaku Gothic Pro', 'メイリオ', meiryo, sans-serif;
    font-weight: 900;
    color: var(--k-text-color);
    font-size: 18vw;
    /* very large, scales with viewport */
    line-height: 1;
    letter-spacing: 0.02em;
    text-align: center;
    text-shadow: var(--k-glow), 0 6px 18px rgba(0, 0, 0, 0.6);
    transform-origin: center center;
}

.kakuhen-text .char {
    display: inline-block;
    opacity: 0;
    transform: scale(0.6);
}

.kakuhen-text .char-1 {
    animation: charPop 360ms cubic-bezier(.2, .9, .2, 1) forwards;
}

.kakuhen-text .char-2 {
    animation: charPunch 420ms cubic-bezier(.12, .9, .2, 1) forwards;
    animation-delay: 260ms;
}

.kakuhen-ripple {
    position: absolute;
    width: 28vw;
    height: 28vw;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255, 80, 80, 0.12), rgba(255, 80, 80, 0.02));
    filter: blur(10px);
    opacity: 0;
    animation: ripplePulse 900ms ease-out forwards;
}

@keyframes dimIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 0.72;
    }
}

@keyframes charPop {
    0% {
        transform: scale(0.6);
        opacity: 0;
    }

    40% {
        transform: scale(1.6);
        opacity: 1;
    }

    65% {
        transform: scale(0.95);
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes charPunch {
    0% {
        transform: scale(0);
        opacity: 0;
    }

    40% {
        transform: scale(2.0);
        opacity: 1;
    }

    70% {
        transform: scale(0.9);
    }

    100% {
        transform: scale(1);
        opacity: 1;
    }
}

@keyframes ripplePulse {
    0% {
        transform: scale(0.2);
        opacity: 0.65;
    }

    60% {
        transform: scale(1.6);
        opacity: 0.18;
    }

    100% {
        transform: scale(2.4);
        opacity: 0;
    }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
    .kakuhen-dim {
        animation: none;
        opacity: 0.72;
    }

    .kakuhen-text .char {
        animation: none;
        opacity: 1;
        transform: none;
    }

    .kakuhen-ripple {
        animation: none;
        opacity: 0;
    }
}
</style>