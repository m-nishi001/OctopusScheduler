<template>
    <UiDialog :model-value="true" :title="isEdit ? '音楽停止イベント編集' : '音楽停止イベント追加'" size="md" :close-on-overlay="false" @close="onClose">
        <form id="stop-audio-form" @submit.prevent="onSubmit">
            <div class="form-group">
                <label for="startTime">開始時間</label>
                <input id="startTime" type="datetime-local" v-model="form.startTime" required />
            </div>
            <div class="form-group">
                <label for="endTime">終了時間</label>
                <input id="endTime" type="datetime-local" v-model="form.endTime" required />
            </div>
            <div class="form-group">
                <label for="fadeOutDuration">フェードアウト時間 (秒)</label>
                <input id="fadeOutDuration" type="number" v-model.number="form.fadeOutDuration" min="0"
                    step="0.1" />
            </div>
        </form>
        <template #footer>
            <UiButton @click="onClose">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="stop-audio-form">{{ isEdit ? '更新' : '追加' }}</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { useStopAudioEvent } from './use-stop-audio-event';

interface Props { event?: any }
const props = defineProps<Props>();
const emit = defineEmits<{ saved: []; close: [] }>();

const { form, isEdit, onSubmit, onClose } = useStopAudioEvent(props, emit);
</script>
