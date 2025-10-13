<template>
    <div class="modal-overlay" @click="onClose">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? 'コンテンツ表示イベント編集' : 'コンテンツ表示イベント追加' }}</h3>
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
                    <label for="contentType">コンテンツ種別</label>
                    <select id="contentType" v-model="form.contentType" required>
                        <option value="image">画像</option>
                        <option value="movie">動画</option>
                        <option value="html">HTML</option>
                    </select>
                </div>
                <div class="form-group" v-if="form.contentType !== 'html'">
                    <label for="contentId">コンテンツID</label>
                    <input id="contentId" type="text" v-model="form.contentId" required />
                </div>
                <div class="form-group" v-if="form.contentType === 'html'">
                    <label for="htmlString">HTML文字列</label>
                    <textarea id="htmlString" v-model="form.htmlString" required></textarea>
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
import type { ShowContentEventEntity } from '../../../../../model/domains/schedule-event/show-content-event/show-content-event-entity';

interface Props {
    event?: ShowContentEventEntity;
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
    contentType: props.event?.contentType || 'image',
    contentId: props.event?.contentId || '',
    htmlString: props.event?.htmlString || '',
    fadeOutDuration: props.event?.fadeOutDuration || 0,
});

watch(() => props.event, (newEvent) => {
    if (newEvent) {
        form.value = {
            startTime: formatDateTime(newEvent.startTime),
            endTime: formatDateTime(newEvent.endTime),
            contentType: newEvent.contentType,
            contentId: newEvent.contentId || '',
            htmlString: newEvent.htmlString || '',
            fadeOutDuration: newEvent.fadeOutDuration || 0,
        };
        isEdit.value = true;
    } else {
        form.value = {
            startTime: '',
            endTime: '',
            contentType: 'image',
            contentId: '',
            htmlString: '',
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