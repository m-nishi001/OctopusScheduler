<template>
    <div v-if="visible" class="prize-dialog-overlay">
        <div class="prize-dialog">
            <h2>おめでとうございます！</h2>
            <div v-if="prizeImageUrl" class="prize-image">
                <img :src="prizeImageUrl" alt="当選景品" />
            </div>
            <div v-if="prizeName" class="prize-name">
                {{ prizeName }}
            </div>
            <button @click="handleClose" class="close-button">閉じる</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineProps, defineEmits } from 'vue';

defineProps<{
    visible: boolean;
    prizeName: string | null;
    prizeImageUrl: string | null;
}>();

const emit = defineEmits<{
    close: [];
}>();

const handleClose = () => {
    emit('close');
};
</script>

<style scoped>
.prize-dialog-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.prize-dialog {
    background-color: white;
    padding: 2rem;
    border-radius: 1rem;
    text-align: center;
    max-width: 700px;
    width: min(90%, 700px);
}

.prize-image img {
    max-width: 100%;
    max-height: 60vh;
    height: auto;
    object-fit: contain;
    margin: 1rem 0;
}

.prize-name {
    font-size: 1.5rem;
    font-weight: bold;
    margin: 1rem 0;
}

.close-button {
    background-color: #10b981;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 1rem;
}

.close-button:hover {
    background-color: #059669;
}
</style>

@media (max-width: 480px) {
.prize-dialog {
padding: 1.25rem;
max-width: 92%;
}

.prize-image img {
max-height: 40vh;
}
}