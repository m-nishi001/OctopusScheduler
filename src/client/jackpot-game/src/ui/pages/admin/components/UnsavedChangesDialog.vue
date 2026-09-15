<template>
    <div v-if="visible" class="modal-overlay">
        <div class="modal-content">
            <h3>未保存の変更があります</h3>
            <p>保存されていない変更があります。他の画面に移動すると変更が破棄されます。</p>
            <div class="button-row">
                <button class="admin-btn" @click="discard">破棄して移動</button>
                <button class="admin-btn cancel" @click="cancel">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineEmits } from 'vue';

defineProps<{
    visible: boolean;
}>();

const emit = defineEmits<{
    discard: [];
    cancel: [];
}>();

const discard = () => {
    emit('discard');
};

const cancel = () => {
    emit('cancel');
};
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
    background: #232b36;
    color: #fff;
    padding: 28px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 400px;
}

.button-row {
    display: flex;
    gap: 12px;
    margin-top: 20px;
    justify-content: center;
}

.admin-btn {
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.admin-btn:hover {
    background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.admin-btn.cancel {
    background: linear-gradient(90deg, #6c757d 0%, #adb5bd 100%);
    color: #fff;
}

.admin-btn.cancel:hover {
    background: linear-gradient(90deg, #adb5bd 0%, #6c757d 100%);
}
</style>