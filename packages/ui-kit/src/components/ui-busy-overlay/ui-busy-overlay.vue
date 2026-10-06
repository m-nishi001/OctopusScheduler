<template>
    <Teleport to="body">
        <div v-if="visible" class="ui-busy" role="alert" aria-busy="true">
            <div class="ui-busy__panel">
                <span class="ui-busy__spinner" aria-hidden="true" />
                <div class="ui-busy__text">
                    <p class="ui-busy__title">{{ title }}</p>
                    <p v-if="message" class="ui-busy__message">{{ message }}</p>
                </div>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{ visible: boolean; title?: string; message?: string }>(), { title: '処理中...' });
</script>

<style scoped>
.ui-busy {
    position: fixed;
    inset: 0;
    z-index: var(--ui-z-toast, 1200);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-space-4, 16px);
    background: var(--ui-overlay, rgba(0, 0, 0, 0.5));
    font-family: var(--ui-font-family, system-ui, sans-serif);
}

.ui-busy__panel {
    display: flex;
    align-items: center;
    gap: var(--ui-space-4, 16px);
    max-width: 100%;
    padding: var(--ui-space-4, 16px) var(--ui-space-5, 24px);
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: calc(var(--ui-radius, 6px) * 2);
}

.ui-busy__title {
    margin: 0;
    font-size: var(--ui-font-md, 1rem);
    font-weight: 700;
}

.ui-busy__message {
    margin: var(--ui-space-1, 4px) 0 0;
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.ui-busy__spinner {
    flex: none;
    width: 28px;
    height: 28px;
    border: 3px solid var(--ui-border, #3a4048);
    border-top-color: var(--ui-accent, #aee1ff);
    border-radius: 50%;
    animation: ui-busy-spin 0.8s linear infinite;
}

@keyframes ui-busy-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
