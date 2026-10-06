<template>
    <Teleport to="body">
        <div v-if="modelValue" class="ui-dialog__overlay" :class="{ 'is-nested': nested }"
            @mousedown.self="onOverlayMouseDown" @mouseup.self="onOverlayMouseUp" @keydown="onKeydown">
            <div ref="panel" class="ui-dialog" :class="`ui-dialog--${size}`" role="dialog" aria-modal="true"
                :aria-labelledby="titleId" tabindex="-1">
                <header class="ui-dialog__header">
                    <h2 :id="titleId" class="ui-dialog__title">{{ title }}</h2>
                    <UiButton v-if="!persistent" class="ui-dialog__close" variant="ghost" size="sm" icon="close"
                        icon-only aria-label="閉じる" @click="close" />
                </header>
                <div class="ui-dialog__body"><slot /></div>
                <footer v-if="$slots.footer || confirmLabel" class="ui-dialog__footer">
                    <slot name="footer">
                        <UiButton :disabled="loading" @click="onCancel">{{ cancelLabel }}</UiButton>
                        <UiButton :variant="danger ? 'danger' : 'primary'" :loading="loading"
                            :disabled="confirmDisabled" @click="emit('confirm')">{{ confirmLabel }}</UiButton>
                    </slot>
                </footer>
            </div>
        </div>
    </Teleport>
</template>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue';
import UiButton from '../ui-button/ui-button.vue';
import { lockScroll } from '../../composables/use-scroll-lock';

export type UiDialogSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const props = withDefaults(
    defineProps<{
        modelValue: boolean;
        title: string;
        size?: UiDialogSize;
        /** true の間は Escape / オーバーレイクリック / ×ボタンで閉じない(保存中・未保存変更など) */
        persistent?: boolean;
        nested?: boolean;
        /** 指定すると標準フッター(キャンセル左 / 主操作右)を表示する */
        confirmLabel?: string;
        cancelLabel?: string;
        danger?: boolean;
        loading?: boolean;
        confirmDisabled?: boolean;
    }>(),
    { size: 'md', cancelLabel: 'キャンセル' },
);

const emit = defineEmits<{ 'update:modelValue': [value: boolean]; close: []; confirm: []; cancel: [] }>();

const panel = ref<HTMLElement | null>(null);
const titleId = `ui-dialog-title-${Math.random().toString(36).slice(2, 9)}`;
let releaseScroll: (() => void) | null = null;
let previouslyFocused: HTMLElement | null = null;
let pressedOnOverlay = false;

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function close() {
    if (props.persistent) return;
    emit('update:modelValue', false);
    emit('close');
}

function onCancel() {
    emit('cancel');
    close();
}

// ドラッグ選択がオーバーレイ上で終わっただけで閉じないよう、押下・解放の両方がオーバーレイ上の場合のみ閉じる
function onOverlayMouseDown() {
    pressedOnOverlay = true;
}
function onOverlayMouseUp() {
    if (pressedOnOverlay) close();
    pressedOnOverlay = false;
}

function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
        e.stopPropagation();
        close();
        return;
    }
    if (e.key !== 'Tab' || !panel.value) return;
    const items = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (!items.length) {
        e.preventDefault();
        return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel.value)) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
    }
}

watch(
    () => props.modelValue,
    async (open) => {
        if (open) {
            previouslyFocused = document.activeElement as HTMLElement | null;
            releaseScroll = lockScroll();
            await nextTick();
            const target = panel.value?.querySelector<HTMLElement>('.ui-dialog__body input, .ui-dialog__body select, .ui-dialog__body textarea');
            (target ?? panel.value)?.focus();
        } else {
            releaseScroll?.();
            releaseScroll = null;
            previouslyFocused?.focus?.();
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => releaseScroll?.());
</script>

<style scoped>
.ui-dialog__overlay {
    position: fixed;
    inset: 0;
    z-index: var(--ui-z-dialog, 1000);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: var(--ui-space-4, 16px);
    background: var(--ui-overlay, rgba(0, 0, 0, 0.5));
    font-family: var(--ui-font-family, system-ui, sans-serif);
}

.ui-dialog__overlay.is-nested {
    z-index: var(--ui-z-dialog-nested, 1100);
}

.ui-dialog {
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    width: 100%;
    max-height: 90vh;
    max-height: 90dvh;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: calc(var(--ui-radius, 6px) * 2);
    outline: none;
    overflow: hidden;
}

.ui-dialog--sm { max-width: 400px; }
.ui-dialog--md { max-width: 560px; }
.ui-dialog--lg { max-width: 720px; }
.ui-dialog--xl { max-width: 960px; }
.ui-dialog--full { max-width: 100%; height: 100%; max-height: 100%; }

.ui-dialog__header {
    display: flex;
    align-items: center;
    gap: var(--ui-space-3, 12px);
    padding: var(--ui-space-3, 12px) var(--ui-space-4, 16px);
    border-bottom: 1px solid var(--ui-border, #3a4048);
}

.ui-dialog__title {
    margin: 0;
    flex: 1;
    min-width: 0;
    font-size: var(--ui-font-lg, 1.2rem);
    font-weight: 700;
    overflow-wrap: anywhere;
}

.ui-dialog__body {
    flex: 1;
    min-height: 0;
    padding: var(--ui-space-4, 16px);
    overflow-x: hidden;
    overflow-y: auto;
    font-size: var(--ui-font-md, 1rem);
}

.ui-dialog__footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--ui-space-2, 8px);
    padding: var(--ui-space-3, 12px) var(--ui-space-4, 16px);
    border-top: 1px solid var(--ui-border, #3a4048);
}

@media (max-width: 640px) {
    .ui-dialog__overlay {
        align-items: flex-end;
        padding: 0;
    }

    .ui-dialog {
        max-width: 100%;
        max-height: 95vh;
        max-height: 95dvh;
        border-radius: calc(var(--ui-radius, 6px) * 2) calc(var(--ui-radius, 6px) * 2) 0 0;
    }

    .ui-dialog--full {
        max-height: 100dvh;
        border-radius: 0;
    }

    .ui-dialog__footer > :deep(.ui-button) {
        flex: 1;
    }
}
</style>
