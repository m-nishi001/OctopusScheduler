<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? '画面遷移イベント編集' : '画面遷移イベント追加' }}</h3>
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
                    <label for="transitionUrl">遷移URL</label>
                    <input id="transitionUrl" type="url" v-model="form.transitionUrl" required />
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
import { container } from 'tsyringe';
import { ScheduleEventService } from '../../../../../model/applications/schedule-event/schedule-event-service';
import { TransitionPageEvent, TransitionPageEventParams } from '../../../../../model/domains/schedule-event/transition/transition-page-event';

interface Props {
    event?: TransitionPageEvent;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    saved: [];
    close: [];
}>();

const isEdit = ref(!!props.event);

function entityToForm(e: TransitionPageEvent) {
    return {
        startTime: formatDateTime(e.startTime),
        endTime: formatDateTime(e.endTime),
        transitionUrl: e.transitionUrl ?? '',
        fadeOutDuration: e.fadeOutDuration ?? 0,
    };
}

const initialEntity = props.event ?? TransitionPageEvent.createEmpty();
const form = ref(entityToForm(initialEntity));

watch(() => props.event, (newEvent) => {
    const e = newEvent ?? TransitionPageEvent.createEmpty();
    form.value = entityToForm(e);
    isEdit.value = !!newEvent;
});

function formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 16);
}

async function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
        alert('開始時間が終了時間より後です。');
        return;
    }
    const scheduleEventService = container.resolve(ScheduleEventService);
    try {
        const baseParams = {
            startTime,
            endTime,
            transitionUrl: form.value.transitionUrl,
            fadeOutDuration: form.value.fadeOutDuration,
        } as const;

        if (props.event) {
            const params = new TransitionPageEventParams({
                id: props.event.id,
                startTime: baseParams.startTime,
                endTime: baseParams.endTime,
                transitionUrl: baseParams.transitionUrl,
                fadeOutDuration: baseParams.fadeOutDuration,
                processedAt: props.event.processedAt,
                registeredAt: props.event.registeredAt,
                updatedAt: new Date(),
            });
            const updated = TransitionPageEvent.fromParams(params);
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            const params = new TransitionPageEventParams({
                id: '',
                startTime: baseParams.startTime,
                endTime: baseParams.endTime,
                transitionUrl: baseParams.transitionUrl,
                fadeOutDuration: baseParams.fadeOutDuration,
                processedAt: null,
                registeredAt: new Date(),
                updatedAt: new Date(),
            });
            const tempEvent = TransitionPageEvent.fromParams(params);
            await scheduleEventService.addScheduleEvents([tempEvent]);
        }
        emit('saved');
        emit('close');
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
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