<template>
    <div class="board" :style="{ '--slots': slots }">
        <transition-group name="ranking" tag="div" class="ranking-list">
            <div v-for="(record, idx) in rows" :key="record.userId || (record.displayName + '-' + idx)"
                class="ranking-item"
                :class="[
                    `rank-${Math.min(record.rank, 4)}`,
                    { placeholder: !record.userId, 'first-place': record.rank === 1 && !!record.userId },
                ]">
                <div v-if="record.rank === 1 && record.userId" class="rays" aria-hidden="true"></div>
                <div class="rank-badge">{{ record.rank }}</div>
                <div class="player-info">
                    <div class="player-name">
                        <span v-if="record.rank === 1 && record.userId" class="crown" aria-hidden="true">👑</span>{{ record.displayName }}
                    </div>
                    <div class="player-time">{{ formatTime(record.timeToAnswerSec) }}</div>
                </div>
                <div v-if="record.rank === 1 && record.userId" class="shimmer" aria-hidden="true"></div>
            </div>
        </transition-group>
    </div>
</template>

<script setup lang="ts">
export interface BoardRow {
    userId: string;
    displayName: string;
    timeToAnswerSec: number | null;
    rank: number;
}

withDefaults(defineProps<{
    rows: BoardRow[];
    /** 同時に表示する最大行数。行の高さの算出に使う。 */
    slots?: number;
}>(), { slots: 10 });

function formatTime(seconds: number | null): string {
    if (seconds === null || typeof seconds !== 'number' || Number.isNaN(seconds)) return '-';
    const negative = seconds < 0;
    const abs = Math.abs(seconds);
    const mins = Math.floor(abs / 60);
    const secs = abs - mins * 60;
    const secsStr = secs.toFixed(3);
    const body = mins > 0 ? `${mins}分${secsStr}秒` : `${secsStr}秒`;
    return negative ? `-${body}` : body;
}
</script>

<style scoped>
.board {
    /* 親の高さを slots 等分した行高。行同士が重ならないよう上限を設ける */
    --gap: clamp(4px, 1vh, 10px);
    --row-h: calc((100% - var(--gap) * (var(--slots) - 1)) / var(--slots));
    min-height: 0;
    width: 100%;
    display: flex;
    justify-content: center;
}

.ranking-list {
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: var(--gap);
    width: 100%;
    max-width: 680px;
    height: 100%;
}

.ranking-item {
    position: relative;
    display: flex;
    align-items: center;
    gap: clamp(8px, 2vh, 16px);
    height: var(--row-h);
    flex: none;
    box-sizing: border-box;
    padding: 0 clamp(10px, 2.4vh, 20px);
    background: rgba(255, 255, 255, 0.07);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 14px;
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
    overflow: hidden;
    font-size: clamp(0.8rem, 2.4vh, 1.2rem);
}

.ranking-enter-from {
    transform: translateX(100%);
    opacity: 0;
}

.ranking-enter-active {
    transition: transform 0.5s ease, opacity 0.5s ease;
}

.ranking-move {
    transition: transform 0.5s ease;
}

.rank-3 {
    border-color: rgba(205, 127, 50, 0.6);
}

.rank-2 {
    border-color: rgba(200, 200, 200, 0.7);
}

.rank-1 {
    border-color: rgba(255, 215, 0, 0.8);
    background: linear-gradient(90deg, rgba(255, 215, 0, 0.22), rgba(255, 215, 0, 0.05));
}

.first-place {
    animation: firstPlaceGlow 1.4s ease-in-out infinite alternate;
    z-index: 2;
}

@keyframes firstPlaceGlow {
    from {
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 12px rgba(255, 215, 0, 0.3);
    }

    to {
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35), 0 0 34px rgba(255, 215, 0, 0.8);
    }
}

.rays {
    position: absolute;
    left: 0;
    top: 50%;
    width: 300%;
    aspect-ratio: 1;
    translate: -45% -50%;
    background: repeating-conic-gradient(from 0deg, rgba(255, 215, 0, 0.16) 0deg 10deg, transparent 10deg 20deg);
    animation: raysSpin 12s linear infinite;
    pointer-events: none;
}

@keyframes raysSpin {
    to {
        rotate: 360deg;
    }
}

.shimmer {
    position: absolute;
    inset: 0;
    background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.4) 50%, transparent 65%);
    transform: translateX(-100%);
    animation: shimmer 2.4s ease-in-out infinite;
    pointer-events: none;
}

@keyframes shimmer {
    60%, 100% {
        transform: translateX(100%);
    }
}

.placeholder {
    opacity: 0.45;
    border-color: rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
}

.rank-badge {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    aspect-ratio: 1;
    height: 78%;
    max-height: 48px;
    border-radius: 50%;
    font-weight: 800;
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    flex-shrink: 0;
}

.crown {
    display: inline-block;
    margin-right: 0.3em;
    animation: crownBob 1s ease-in-out infinite alternate;
}

@keyframes crownBob {
    to {
        transform: translateY(-2px) rotate(8deg);
    }
}

.rank-1:not(.placeholder) .rank-badge {
    background: linear-gradient(145deg, #ffe27a, #d4a017);
    color: #3a2900;
    box-shadow: 0 0 14px rgba(255, 215, 0, 0.7);
}

.rank-2:not(.placeholder) .rank-badge {
    background: linear-gradient(145deg, #f2f2f2, #a8a8a8);
    color: #2b2b2b;
}

.rank-3:not(.placeholder) .rank-badge {
    background: linear-gradient(145deg, #e3ac72, #ad6a2e);
    color: #2b1400;
}

.player-info {
    position: relative;
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
}

.player-name {
    font-size: 1em;
    font-weight: 700;
    color: #fff;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.player-time {
    font-size: 0.75em;
    color: rgba(255, 255, 255, 0.65);
    font-variant-numeric: tabular-nums;
}

.first-place .player-name {
    color: #fff8e1;
    font-size: 1.15em;
}

@media (prefers-reduced-motion: reduce) {
    .rays,
    .shimmer,
    .first-place,
    .crown {
        animation: none;
    }
}
</style>
