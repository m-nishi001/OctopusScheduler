<template>
    <RouterLink :to="to" class="pp-banner" data-testid="event-banner" :aria-label="`${label} ${title}。タップして参加画面を開く`">
        <span class="pp-banner__pulse" aria-hidden="true" />
        <span class="pp-banner__body">
            <span class="pp-banner__label">{{ label }}</span>
            <span class="pp-banner__title">{{ title }}</span>
        </span>
        <span class="pp-banner__go" aria-hidden="true">開く ›</span>
    </RouterLink>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router';

defineProps<{ title: string; label: string; to: string }>();
</script>

<style scoped>
.pp-banner {
    position: sticky;
    top: var(--pp-header-h);
    z-index: 4;
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 56px;
    padding: 8px 16px;
    text-decoration: none;
    color: var(--pp-gold-light);
    background: linear-gradient(90deg, var(--pp-red-deep), var(--pp-red) 50%, var(--pp-red-deep));
    border-top: 1px solid var(--pp-gold);
    border-bottom: 1px solid var(--pp-gold);
    box-shadow: 0 6px 20px rgba(200, 16, 46, 0.45);
}

.pp-banner__pulse {
    flex: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--pp-gold);
    box-shadow: 0 0 0 0 rgba(255, 213, 74, 0.7);
    animation: pp-banner-pulse 1.4s ease-out infinite;
}

.pp-banner__body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}

.pp-banner__label {
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    color: var(--pp-gold);
}

.pp-banner__title {
    font-size: 1rem;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.pp-banner__go {
    flex: none;
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--pp-gold);
}

@keyframes pp-banner-pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 213, 74, 0.7);
    }

    100% {
        box-shadow: 0 0 0 14px rgba(255, 213, 74, 0);
    }
}
</style>
