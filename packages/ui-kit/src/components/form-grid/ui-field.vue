<template>
    <div class="ui-field" :class="{ 'ui-form-grid__full': full }">
        <label class="ui-field__label">
            <span class="ui-field__text">{{ label }}<span v-if="required" class="ui-field__required">*</span></span>
            <slot />
        </label>
        <p v-if="hint && !error" class="ui-field__hint">{{ hint }}</p>
        <p v-if="error" class="ui-field__error" role="alert">{{ error }}</p>
    </div>
</template>

<script setup lang="ts">
defineProps<{ label: string; hint?: string; error?: string; required?: boolean; full?: boolean }>();
</script>

<style scoped>
.ui-field {
    min-width: 0;
}

.ui-field__label {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-1, 4px);
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
}

.ui-field__required {
    color: var(--ui-danger, #e5484d);
    margin-left: 2px;
}

.ui-field__label :deep(input),
.ui-field__label :deep(select),
.ui-field__label :deep(textarea) {
    box-sizing: border-box;
    width: 100%;
    min-height: var(--ui-control-height, 36px);
    padding: var(--ui-space-1, 4px) var(--ui-space-3, 12px);
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: var(--ui-radius, 6px);
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
    font: inherit;
    font-size: var(--ui-font-md, 1rem);
}

.ui-field__label :deep(input:focus),
.ui-field__label :deep(select:focus),
.ui-field__label :deep(textarea:focus) {
    outline: 2px solid var(--ui-accent, #aee1ff);
    outline-offset: 0;
}

.ui-field__hint,
.ui-field__error {
    margin: var(--ui-space-1, 4px) 0 0;
    font-size: var(--ui-font-xs, 0.75rem);
}

.ui-field__hint {
    color: var(--ui-text-muted, #cfd6dd);
}

.ui-field__error {
    color: var(--ui-danger, #e5484d);
}
</style>
