<template>
    <UiDialog :model-value="true" :title="isEdit ? '画面遷移イベント編集' : '画面遷移イベント追加'" size="md" :close-on-overlay="false" @close="onClose">
        <form id="screen-transition-form" @submit.prevent="onSubmit">
            <div class="form-group">
                <label for="startTime">開始時間</label>
                <input id="startTime" type="datetime-local" v-model="form.startTime" required />
            </div>
            <div class="form-group">
                <label for="endTime">終了時間</label>
                <input id="endTime" type="datetime-local" v-model="form.endTime" required />
            </div>
            <div class="form-group">
                <label for="transitionUrl">遷移URL</label>
                <input id="transitionUrl" type="text" list="transition-url-presets" placeholder="/quiz-admin" v-model="form.transitionUrl" required />
                <datalist id="transition-url-presets">
                    <option v-for="p in TRANSITION_URL_PRESETS" :key="p.value" :value="p.value">{{ p.label }}</option>
                </datalist>
                <small>実行画面を切り替える先のパスです。クイズは /quiz/クイズID/intro の形式です。</small>
            </div>
            <div class="form-group">
                <label for="fadeOutDuration">フェードアウト時間 (秒)</label>
                <input id="fadeOutDuration" type="number" v-model.number="form.fadeOutDuration" min="0"
                    step="0.1" />
            </div>
        </form>
        <template #footer>
            <UiButton @click="onClose">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="screen-transition-form">{{ isEdit ? '更新' : '追加' }}</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { TRANSITION_URL_PRESETS } from '../../../help/help-content';
import { useScreenTransitionEvent } from './use-screen-transition-event';
interface Props { event?: any }
const props = defineProps<Props>();
const emit = defineEmits<{ saved: []; close: [] }>();
const { form, isEdit, onSubmit, onClose } = useScreenTransitionEvent(props, emit);
</script>
