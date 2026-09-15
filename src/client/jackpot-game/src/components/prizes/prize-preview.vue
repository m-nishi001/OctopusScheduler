<template>
    <div class="prize-preview">
        <img :src="previewUrl" alt="景品画像" />
        <div class="prize-info">
            <h4>{{ prize.name }}</h4>
            <p>ランク: {{ prize.rank }}</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps({
    prize: { type: Object, required: true },
    objectUrlMap: { type: Object, required: true },
});

const previewUrl = computed(() => {
    return props.objectUrlMap.get(props.prize.imageAssetId) || props.prize.imageAssetId;
});
</script>

<style scoped>
.prize-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid #ccc;
    padding: 10px;
}

.prize-preview img {
    width: 100px;
    height: 100px;
    object-fit: cover;
}

.prize-info {
    text-align: center;
}
</style>