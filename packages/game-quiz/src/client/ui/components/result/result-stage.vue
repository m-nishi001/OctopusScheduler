<template>
    <div class="stage">
        <header class="stage-header">
            <h1 class="stage-title" :class="{ glow: celebrating }">結果発表</h1>
            <p v-if="noWinner" class="no-winner" role="status">
                <span class="no-winner-icon" aria-hidden="true">😢</span>全員不正解…！
            </p>
        </header>
        <main class="stage-body">
            <div v-if="loading" class="loading-state" aria-live="polite">
                <div class="spinner" aria-hidden="true"></div>
                <p>集計中...</p>
            </div>
            <slot v-else />
        </main>
        <CelebrationCanvas :active="celebrating" :winner-name="winnerName" />
    </div>
</template>

<script setup lang="ts">
import CelebrationCanvas from './celebration-canvas.vue';

defineProps<{
    loading: boolean;
    celebrating: boolean;
    winnerName: string;
    noWinner?: boolean;
}>();
</script>

<style scoped>
.stage {
    position: relative;
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    padding: clamp(8px, 2vh, 24px) clamp(12px, 3vw, 32px) clamp(12px, 2.5vh, 28px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: clamp(6px, 1.5vh, 16px);
    overflow: hidden;
    color: #fff;
    background: radial-gradient(ellipse at 50% 0%, #1b2a5c 0%, #0a0f26 55%, #000 100%);
}

.stage-header {
    text-align: center;
}

.stage-title {
    margin: 0;
    font-size: clamp(1.4rem, 5vh, 3rem);
    font-weight: 900;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
    background: linear-gradient(180deg, #fff6c8, #ffd700 55%, #c88a00);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 0 8px rgba(255, 215, 0, 0.35));
}

.stage-title.glow {
    animation: titleGlow 0.8s ease-in-out infinite alternate;
}

@keyframes titleGlow {
    to {
        filter: drop-shadow(0 0 22px rgba(255, 215, 0, 0.95));
    }
}

.stage-body {
    min-height: 0;
    display: flex;
    justify-content: center;
}

.stage-body > :deep(.board) {
    flex: 1;
}

.loading-state {
    align-self: center;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    color: rgba(255, 255, 255, 0.8);
    font-size: 1.1rem;
}

.spinner {
    width: 36px;
    height: 36px;
    border: 4px solid rgba(255, 255, 255, 0.15);
    border-top-color: #ffd700;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}

.no-winner {
    margin: clamp(4px, 1vh, 12px) 0 0;
    font-size: clamp(1.2rem, 4vh, 2.4rem);
    font-weight: 800;
    color: #b6c4e6;
    animation: noWinnerDrop 0.9s cubic-bezier(0.22, 1.4, 0.36, 1) both;
}

.no-winner-icon {
    display: inline-block;
    margin-right: 0.3em;
    transform-origin: 50% 0;
    animation: noWinnerSway 2.4s ease-in-out 0.9s infinite;
}

@keyframes noWinnerDrop {
    from {
        opacity: 0;
        transform: translateY(-40px);
    }
}

@keyframes noWinnerSway {
    0%,
    100% {
        transform: rotate(-12deg);
    }
    50% {
        transform: rotate(12deg);
    }
}

@media (prefers-reduced-motion: reduce) {
    .stage-title.glow,
    .no-winner,
    .no-winner-icon {
        animation: none;
    }
}
</style>
