<template>
    <TransitionGroup tag="ul" name="bubble" class="bubbles" :style="{ '--bubble-size': `${size}px` }" data-testid="entry-bubbles" aria-label="エントリーした人">
        <li v-for="(e, i) in entrants" :key="e.id" class="bubble" :class="{ 'is-latest': i === entrants.length - 1 }"
            :style="{ '--float-delay': `${floatDelay(e.id)}s`, '--hue': hue(e.id) }" data-testid="entry-bubble">
            <span class="bubble__avatar">
                <img v-if="e.photoUrl" :src="e.photoUrl" :alt="e.name" class="bubble__photo" />
                <span v-else class="bubble__initial" aria-hidden="true">{{ initial(e.name) }}</span>
            </span>
            <span class="bubble__name">{{ e.name }}</span>
        </li>
    </TransitionGroup>
</template>

<script setup lang="ts">
import { computed } from 'vue';

export interface Entrant {
    /** 一意なID（メンバーID、無ければ端末ID）。 */
    id: string;
    name: string;
    /** 顔写真のURL。無ければ頭文字のアバターを出す。 */
    photoUrl?: string;
}

const props = defineProps<{ entrants: Entrant[] }>();

/** 人数が増えるほど小さくして、画面に収める。 */
const size = computed(() => {
    const n = props.entrants.length;
    if (n <= 8) return 168;
    if (n <= 20) return 132;
    if (n <= 40) return 104;
    if (n <= 80) return 80;
    if (n <= 150) return 64;
    return 48;
});

/** IDから決まる値（再描画しても同じ見た目・同じ動きになる）。 */
function hash(id: string): number {
    let h = 2166136261;
    for (let i = 0; i < id.length; i++) {
        h ^= id.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}
const floatDelay = (id: string): number => -((hash(id) % 1000) / 1000) * 4;
const hue = (id: string): number => hash(id) % 360;
const initial = (name: string): string => Array.from(name.trim())[0] ?? '?';
</script>

<style scoped>
.bubbles {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    align-content: center;
    justify-content: center;
    gap: calc(var(--bubble-size) * 0.12);
    width: 100%;
    height: 100%;
    overflow: hidden;
}

.bubble {
    width: var(--bubble-size);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    animation: bubble-float 4s ease-in-out infinite;
    animation-delay: var(--float-delay);
}

.bubble__avatar {
    width: var(--bubble-size);
    height: var(--bubble-size);
    border-radius: 50%;
    overflow: hidden;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 3px solid #ffd54a;
    background: hsl(var(--hue) 55% 32%);
    box-shadow:
        0 0 0 3px rgba(255, 213, 74, 0.25),
        0 8px 24px rgba(0, 0, 0, 0.45),
        inset 0 0 18px rgba(255, 255, 255, 0.18);
}

.bubble__photo {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.bubble__initial {
    font-size: calc(var(--bubble-size) * 0.45);
    font-weight: 900;
    color: #fff8e1;
}

.bubble__name {
    max-width: calc(var(--bubble-size) * 1.3);
    font-size: clamp(0.7rem, calc(var(--bubble-size) * 0.14), 1.2rem);
    font-weight: 700;
    color: #fff8e1;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* 最後に入った人は光らせる */
.bubble.is-latest .bubble__avatar {
    border-color: #fff2b0;
    box-shadow:
        0 0 0 4px rgba(255, 213, 74, 0.5),
        0 0 34px rgba(255, 213, 74, 0.85),
        inset 0 0 18px rgba(255, 255, 255, 0.25);
}

/* ポンッと現れる（行き過ぎて戻る） */
.bubble-enter-active {
    transition:
        transform 0.7s cubic-bezier(0.18, 1.5, 0.4, 1),
        opacity 0.3s ease-out;
}

.bubble-enter-from {
    opacity: 0;
    transform: scale(0.1) translateY(60px);
}

.bubble-move {
    transition: transform 0.5s ease;
}

@keyframes bubble-float {
    0%,
    100% {
        transform: translateY(0);
    }

    50% {
        transform: translateY(-8px);
    }
}

@media (prefers-reduced-motion: reduce) {
    .bubble {
        animation: none;
    }

    .bubble-enter-active,
    .bubble-move {
        transition: none;
    }
}
</style>
