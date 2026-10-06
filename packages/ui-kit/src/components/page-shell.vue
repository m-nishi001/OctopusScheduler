<template>
    <div class="ui-page-shell">
        <header class="ui-page-shell__header">
            <h1 class="ui-page-shell__title">{{ title }}</h1>
            <div class="ui-page-shell__actions"><slot name="actions" /></div>
        </header>
        <nav v-if="tabs.length" class="ui-page-shell__tabs" role="tablist">
            <button v-for="tab in tabs" :key="tab.key" type="button" role="tab"
                class="ui-page-shell__tab" :class="{ 'is-active': tab.key === activeKey }"
                :aria-selected="tab.key === activeKey" @click="emit('select', tab.key)">
                {{ tab.label }}
            </button>
        </nav>
        <nav v-if="$slots.subtabs" class="ui-page-shell__tabs ui-page-shell__tabs--sub">
            <slot name="subtabs" />
        </nav>
        <main class="ui-page-shell__main"><slot /></main>
        <footer v-if="$slots.footer" class="ui-page-shell__footer"><slot name="footer" /></footer>
        <FeedbackHost />
    </div>
</template>

<script setup lang="ts">
import FeedbackHost from './feedback/feedback-host.vue';

export interface PageShellTab {
    key: string;
    label: string;
}

withDefaults(defineProps<{ title: string; tabs?: PageShellTab[]; activeKey?: string }>(), {
    tabs: () => [],
    activeKey: '',
});

const emit = defineEmits<{ select: [key: string] }>();
</script>

<style scoped>
.ui-page-shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    height: 100dvh;
    width: 100%;
    box-sizing: border-box;
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
    font-family: var(--ui-font-family, system-ui, sans-serif);
    font-size: var(--ui-font-md, 1rem);
    overflow-x: hidden;
}

.ui-page-shell__header {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 8px 4vw;
    background: var(--ui-surface, #2b3036);
}

.ui-page-shell__title {
    margin: 0;
    font-size: var(--ui-font-lg, 1.2rem);
    font-weight: 700;
    line-height: 1.4;
}

.ui-page-shell__actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
}

.ui-page-shell__tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 6px 4vw 0;
    background: var(--ui-surface-alt, #222731);
    border-bottom: 1px solid var(--ui-border, #3a4048);
}

.ui-page-shell__tabs--sub {
    background: transparent;
    padding-top: 8px;
    padding-bottom: 8px;
}

.ui-page-shell__tab {
    appearance: none;
    background: none;
    border: none;
    border-bottom: 3px solid transparent;
    border-radius: 0;
    color: var(--ui-text-muted, #cfd6dd);
    padding: 8px 14px;
    font-size: var(--ui-font-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
}

.ui-page-shell__tab:hover {
    color: var(--ui-text, #fff);
}

.ui-page-shell__tab.is-active {
    color: var(--ui-accent, #aee1ff);
    border-bottom-color: var(--ui-accent, #aee1ff);
}

.ui-page-shell__main {
    flex: 1;
    min-width: 0;
    min-height: 0;
    padding: 16px 4vw;
    overflow-x: hidden;
    overflow-y: auto;
}

.ui-page-shell__footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    padding: 8px 4vw;
    background: var(--ui-surface, #2b3036);
    border-top: 1px solid var(--ui-border, #3a4048);
}

@media (max-width: 640px) {
    .ui-page-shell__header,
    .ui-page-shell__tabs,
    .ui-page-shell__main,
    .ui-page-shell__footer {
        padding-left: 12px;
        padding-right: 12px;
    }
}
</style>
