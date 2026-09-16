<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? '音楽停止イベント編集' : '音楽停止イベント追加' }}</h3>
            <form @submit.prevent="onSubmit">
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
                <div class="form-actions">
                    <button type="button" class="main-btn" @click="onClose">キャンセル</button>
                    <button type="submit" class="main-btn">{{ isEdit ? '更新' : '追加' }}</button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { useStopAudioEvent } from './stop-audio-event-register';

interface Props { event?: any }
const props = defineProps<Props>();
const emit = defineEmits<{ saved: []; close: [] }>();

const { form, isEdit, onSubmit, onClose } = useStopAudioEvent(props, emit);
</script>

<style scoped>
/* Reuse styles from other dialogs (kept minimal here) */
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000
}

.modal-content {
    background: #232323;
    color: #fff;
    padding: 2em;
    border-radius: 10px;
    max-width: 600px;
    width: 90%
}

.form-group {
    margin-bottom: 1em
}

.form-group label {
    display: block;
    margin-bottom: 0.5em
}

.form-actions {
    display: flex;
    gap: 1em;
    justify-content: flex-end
}
</style>
