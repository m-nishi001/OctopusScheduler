<template>
    <UiDialog :model-value="true" title="スケジュールイベント種別選択" size="sm" @close="onClose">
        <div class="event-type-list">
            <UiButton v-for="t in types" :key="t.type" class="event-type-btn" @click="selectType(t.type)">{{ t.label }}</UiButton>
        </div>
        <template #footer>
            <UiButton @click="onClose">キャンセル</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';

const types = [
    { type: 'ShowContentEvent', label: 'コンテンツ表示イベント' },
    { type: 'PlayAudioEvent', label: '音楽再生イベント' },
    { type: 'TransitionPageEvent', label: '画面遷移イベント' },
    { type: 'SlideshowEvent', label: 'スライドショーイベント' },
    { type: 'StopAudioEvent', label: '音楽停止イベント' },
];

const emit = defineEmits<{
    select: [type: string];
    close: [];
}>();

function selectType(type: string) {
    emit('select', type);
    emit('close');
}

function onClose() {
    emit('close');
}
</script>

<style scoped>
.event-type-list {
    display: flex;
    flex-direction: column;
    gap: var(--ui-space-2, 8px);
}

.event-type-btn {
    width: 100%;
}
</style>
