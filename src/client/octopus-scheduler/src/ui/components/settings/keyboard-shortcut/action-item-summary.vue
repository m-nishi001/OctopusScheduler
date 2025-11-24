<template>
    <div class="action-row">
        <div class="meta">
            <strong>{{ label }}</strong>
            <div class="summary">{{ summary }}</div>
        </div>
        <div class="controls">
            <button @click="$emit('edit', index)">編集</button>
            <button @click="$emit('move-up', index)" :disabled="index === 0" aria-label="Move action up">↑</button>
            <button @click="$emit('move-down', index)" :disabled="index === length - 1"
                aria-label="Move action down">↓</button>
            <button @click="$emit('remove', index)">削除</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { EventFormData } from './types';
import { container } from 'tsyringe';
import { UIActionEntryToken } from '../../../../core/container';

const ACTION_REGISTRY: Record<string, any> = (() => {
    try {
        const entries = container.resolveAll<any>(UIActionEntryToken as any) as any[];
        const m: Record<string, any> = {};
        for (const e of entries) if (e && e.actionType) m[e.actionType] = e;
        return m;
    } catch (err) {
        return {};
    }
})();

const props = defineProps<{
    action: EventFormData;
    index: number;
    length: number;
}>();

const emit = defineEmits<{
    (e: 'edit', index: number): void;
    (e: 'move-up', index: number): void;
    (e: 'move-down', index: number): void;
    (e: 'remove', index: number): void;
}>();

const label = computed(() => {
    const entry = ACTION_REGISTRY[props.action.actionType];
    return entry ? entry.label : props.action.actionType;
});

function summarize(a: EventFormData): string {
    switch (a.actionType) {
        case 'PlayAudioEvent':
            return `audio: ${a.audioId || '（未選択）'}`;
        case 'SlideshowEvent':
            return `folder: ${a.folderId || '（未設定）'} / ${a.displayDuration ?? '-'}s`;
        case 'TransitionPageEvent':
            return `url: ${a.transitionUrl || '（未設定）'}`;
        case 'ShowContentEvent':
            return `${a.contentType}: ${a.contentId || '（未選択）'}`;
        default:
            return '';
    }
}

const summary = computed(() => summarize(props.action));
</script>

<style scoped>
.action-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px;
    border-bottom: 1px solid #444;
}

.meta {
    flex: 1;
}

.summary {
    color: #bbb;
    font-size: 12px;
}

.controls {
    display: flex;
    gap: 6px;
}

button[disabled] {
    opacity: 0.4;
}
</style>
