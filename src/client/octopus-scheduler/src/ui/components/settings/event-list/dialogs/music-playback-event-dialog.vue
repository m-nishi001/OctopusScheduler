<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? '音楽再生イベント編集' : '音楽再生イベント追加' }}</h3>
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
                    <label for="audioId">オーディオID</label>
                    <input id="audioId" type="text" v-model="form.audioId" required />
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
import { ref, watch } from 'vue';
import type { PlayAudioEventDto } from '../../../../../model/applications/schedule-event/play-audio-event/play-audio-event-dto';

interface Props {
    event?: PlayAudioEventDto;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    submit: [form: any];
    close: [];
}>();

const isEdit = ref(!!props.event);

const form = ref({
    startTime: props.event ? formatDateTime(props.event.startTime) : '',
    endTime: props.event ? formatDateTime(props.event.endTime) : '',
    audioId: props.event?.audioId || '',
    fadeOutDuration: props.event?.fadeOutDuration || 0,
});

watch(() => props.event, (newEvent) => {
    if (newEvent) {
        form.value = {
            startTime: formatDateTime(newEvent.startTime),
            endTime: formatDateTime(newEvent.endTime),
            audioId: newEvent.audioId,
            fadeOutDuration: newEvent.fadeOutDuration || 0,
        };
        isEdit.value = true;
    } else {
        form.value = {
            startTime: '',
            endTime: '',
            audioId: '',
            fadeOutDuration: 0,
        };
        isEdit.value = false;
    }
});

function formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 16);
}

function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
        alert('開始時間が終了時間より後です。');
        return;
    }
    emit('submit', {
        ...form.value,
        startTime,
        endTime,
    });
    emit('close');
}

function onClose() {
    emit('close');
}
</script>

<style scoped>
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
    z-index: 1000;
}

.modal-content {
    background: #232323;
    color: #fff;
    padding: 2em;
    border-radius: 10px;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
}

.modal-content h3 {
    margin-bottom: 1em;
    color: #8fd3ff;
}

.form-group {
    margin-bottom: 1em;
}

.form-group label {
    display: block;
    margin-bottom: 0.5em;
    color: #fff;
}

.form-group input {
    width: 100%;
    padding: 0.5em;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 6px;
}

.form-actions {
    margin-top: 1em;
    display: flex;
    gap: 1.2em;
    justify-content: flex-end;
}

.main-btn {
    font-size: 1.05em;
    font-weight: 600;
    padding: 0.8em 2em;
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
    outline: none;
}

.main-btn:hover,
.main-btn:focus {
    background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px) scale(1.04);
}
</style>