<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? 'スライドショーイベント編集' : 'スライドショーイベント追加' }}</h3>
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
                    <label for="folderId">Google DriveフォルダID</label>
                    <input id="folderId" type="text" v-model="form.folderId" required />
                </div>
                <div class="form-group">
                    <label for="displayDuration">表示時間 (秒)</label>
                    <input id="displayDuration" type="number" v-model.number="form.displayDuration" min="1" required />
                </div>
                <div class="form-group">
                    <label for="transitionType">切替アクション</label>
                    <select id="transitionType" v-model="form.transitionType" required>
                        <option value="fade">フェード</option>
                        <option value="slide">スライド</option>
                    </select>
                </div>
                <div class="form-group" v-if="form.transitionType === 'slide'">
                    <label for="slideDirection">スライド方向</label>
                    <select id="slideDirection" v-model="form.slideDirection" required>
                        <option value="left">左</option>
                        <option value="right">右</option>
                        <option value="up">上</option>
                        <option value="down">下</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="bgmIds">BGM ID (カンマ区切りで複数指定)</label>
                    <input id="bgmIds" type="text" v-model="form.bgmIds" />
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
import type { SlideshowEventDto } from '../../../../../model/applications/schedule-event/slideshow-event/slideshow-event-dto';

interface Props {
    event?: SlideshowEventDto;
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
    folderId: props.event?.folderId || '',
    displayDuration: props.event?.displayDuration || 5,
    transitionType: props.event?.transitionType || 'fade',
    slideDirection: props.event?.slideDirection || 'left',
    bgmIds: props.event?.bgmIds.join(',') || '',
});

watch(() => props.event, (newEvent) => {
    if (newEvent) {
        form.value = {
            startTime: formatDateTime(newEvent.startTime),
            endTime: formatDateTime(newEvent.endTime),
            folderId: newEvent.folderId,
            displayDuration: newEvent.displayDuration,
            transitionType: newEvent.transitionType,
            slideDirection: newEvent.slideDirection || 'left',
            bgmIds: newEvent.bgmIds.join(','),
        };
        isEdit.value = true;
    } else {
        form.value = {
            startTime: '',
            endTime: '',
            folderId: '',
            displayDuration: 5,
            transitionType: 'fade',
            slideDirection: 'left',
            bgmIds: '',
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
        bgmIds: form.value.bgmIds.split(',').map(id => id.trim()).filter(id => id),
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

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 0.5em;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 6px;
}

.form-group textarea {
    min-height: 100px;
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