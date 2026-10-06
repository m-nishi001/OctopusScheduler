<template>
    <button class="ui-button" :class="[`ui-button--${variant}`, `ui-button--${size}`, { 'is-icon-only': iconOnly }]"
        :type="type" :disabled="disabled || loading" :aria-busy="loading || undefined">
        <span v-if="loading" class="ui-button__spinner" aria-hidden="true" />
        <UiIcon v-else-if="icon" :name="icon" />
        <span v-if="$slots.default" class="ui-button__label"><slot /></span>
    </button>
</template>

<script setup lang="ts">
import UiIcon from '../ui-icon/ui-icon.vue';
import type { UiIconName } from '../ui-icon/icons';

withDefaults(
    defineProps<{
        variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
        size?: 'sm' | 'md';
        type?: 'button' | 'submit';
        icon?: UiIconName;
        iconOnly?: boolean;
        loading?: boolean;
        disabled?: boolean;
    }>(),
    { variant: 'secondary', size: 'md', type: 'button' },
);
</script>

<style scoped>
.ui-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--ui-space-2, 8px);
    min-height: var(--ui-control-height, 36px);
    padding: 0 var(--ui-space-4, 16px);
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: var(--ui-radius, 6px);
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    font: inherit;
    font-size: var(--ui-font-sm, 0.875rem);
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
}

.ui-button--sm {
    min-height: 28px;
    padding: 0 var(--ui-space-3, 12px);
    font-size: var(--ui-font-xs, 0.75rem);
}

.ui-button.is-icon-only {
    padding: 0;
    width: var(--ui-control-height, 36px);
}

.ui-button--sm.is-icon-only {
    width: 28px;
}

.ui-button--primary {
    background: var(--ui-accent, #aee1ff);
    border-color: var(--ui-accent, #aee1ff);
    color: var(--ui-accent-contrast, #12263a);
}

.ui-button--danger {
    background: var(--ui-danger, #e5484d);
    border-color: var(--ui-danger, #e5484d);
    color: var(--ui-danger-contrast, #fff);
}

.ui-button--ghost {
    background: transparent;
    border-color: transparent;
}

.ui-button:hover:not(:disabled) {
    filter: brightness(1.12);
}

.ui-button:focus-visible {
    outline: 2px solid var(--ui-accent, #aee1ff);
    outline-offset: 2px;
}

.ui-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.ui-button__spinner {
    width: 14px;
    height: 14px;
    border: 2px solid currentColor;
    border-right-color: transparent;
    border-radius: 50%;
    animation: ui-button-spin 0.7s linear infinite;
}

@keyframes ui-button-spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
