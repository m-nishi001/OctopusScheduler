<template>
    <div class="prize-list">
        <div class="list-grid">
            <PrizePreview v-for="prize in prizes" :key="prize.id" :prize="prize" :object-url-map="objectUrlMap"
                @click="onSelect(prize)" />
        </div>
    </div>
</template>

<script setup lang="ts">
const props = defineProps({
    prizes: { type: Array, required: true },
    objectUrlMap: { type: Object, required: true },
});

const emit = defineEmits(['select']);

const onSelect = (prize: any) => {
    emit('select', prize);
};
</script>

<style scoped>
.prize-list {
    overflow-x: hidden;
    overflow-y: auto;
}

.list-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 10px;
}
</style>