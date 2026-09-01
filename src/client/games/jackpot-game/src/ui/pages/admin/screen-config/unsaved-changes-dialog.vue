<template>
    <div v-if="visible" class="modal-overlay">
        <div class="modal-content">
            <h3>未保存の変更があります</h3>
            <p>変更を保存せずに移動すると、変更内容とアップロードされたアセットが破棄されます。</p>
            <p>変更を保存しますか？</p>
            <div class="modal-buttons">
                <button class="admin-btn cancel-btn" @click="handleCancel">キャンセル</button>
                <button class="admin-btn discard-btn" @click="handleDiscard">破棄して移動</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineEmits } from 'vue';

const emit = defineEmits<{
    discard: [];
    cancel: [];
}>();

defineProps<{
    visible: boolean;
}>();

const handleDiscard = () => {
    emit('discard');
};

const handleCancel = () => {
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

.modal-buttons {
    display: flex;
    gap: 16px;
    justify-content: center;
    margin-top: 24px;
}

.cancel-btn {
    background: #6c757d !important;
}

.discard-btn {
    background: #dc3545 !important;
}

.discard-btn:hover {
    background: #c82333 !important;
}
</style>
