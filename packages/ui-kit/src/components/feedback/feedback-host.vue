<template>
    <UiDialog v-if="current" :key="current.id" :model-value="true" size="sm" :title="current.title ?? '確認'" nested
        :confirm-label="current.confirmLabel ?? 'OK'" :danger="current.danger"
        @confirm="resolveConfirm(true)" @close="resolveConfirm(false)">
        <p class="ui-feedback__message">{{ current.message }}</p>
        <template v-if="current.showCancel === false" #footer>
            <UiButton variant="primary" @click="resolveConfirm(true)">{{ current.confirmLabel ?? 'OK' }}</UiButton>
        </template>
    </UiDialog>
    <Teleport to="body">
        <div v-if="toasts.length" class="ui-toasts" aria-live="polite">
            <div v-for="t in toasts" :key="t.id" class="ui-toast" :class="`ui-toast--${t.kind}`" role="status"
                @click="dismissToast(t.id)">
                {{ t.message }}
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import UiDialog from '../ui-dialog/ui-dialog.vue';
import UiButton from '../ui-button/ui-button.vue';
import { confirmQueue, dismissToast, resolveConfirm, toasts } from '../../composables/use-feedback';

const current = computed(() => confirmQueue[0]);
</script>

<style scoped>
.ui-feedback__message {
    margin: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
}

.ui-toasts {
    position: fixed;
    right: var(--ui-space-4, 16px);
    bottom: var(--ui-space-4, 16px);
    z-index: var(--ui-z-toast, 1200);
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2, 8px);
    max-width: calc(100vw - 32px);
    font-family: var(--ui-font-family, system-ui, sans-serif);
}

.ui-toast {
    padding: var(--ui-space-3, 12px) var(--ui-space-4, 16px);
    border-radius: var(--ui-radius, 6px);
    background: var(--ui-surface, #2b3036);
    border: 1px solid var(--ui-border, #3a4048);
    color: var(--ui-text, #fff);
    font-size: var(--ui-font-sm, 0.875rem);
    cursor: pointer;
}

.ui-toast--success { border-color: var(--ui-accent, #aee1ff); }
.ui-toast--error { border-color: var(--ui-danger, #e5484d); }

@media (max-width: 640px) {
    .ui-toasts {
        left: var(--ui-space-3, 12px);
        right: var(--ui-space-3, 12px);
    }
}
</style>
