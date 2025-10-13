<template>
    <div class="modal-overlay" @click="onClose">
        <div class="modal-content" @click.stop>
            <h3>スケジュールイベント種別選択</h3>
            <div class="event-type-list">
                <button class="event-type-btn" @click="selectType('ShowContentEvent')">コンテンツ表示イベント</button>
                <button class="event-type-btn" @click="selectType('PlayAudioEvent')">音楽再生イベント</button>
                <button class="event-type-btn" @click="selectType('TransitionPageEvent')">画面遷移イベント</button>
                <button class="event-type-btn" @click="selectType('SlideshowEvent')">スライドショーイベント</button>
            </div>
            <div class="form-actions">
                <button class="main-btn" @click="onClose">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineEmits } from 'vue';

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

.event-type-list {
    display: flex;
    flex-direction: column;
    gap: 1em;
    margin-bottom: 1em;
}

.event-type-btn {
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    border: none;
    border-radius: 10px;
    padding: 1em;
    cursor: pointer;
    font-size: 1.1em;
    font-weight: 600;
    transition: box-shadow 0.18s, transform 0.12s;
}

.event-type-btn:hover {
    box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
    transform: translateY(-2px);
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