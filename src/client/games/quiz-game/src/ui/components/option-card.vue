<template>
    <div class="option-card" role="listitem">
        <button class="option-button" :style="styleVars" @click="onSelect" :aria-label="ariaLabel">
            <div class="image-wrapper">
                <img v-if="imageUrl" :src="imageUrl" :alt="option.text" class="option-image" />
                <div class="option-index">{{ index + 1 }}</div>
                <div class="text-ribbon">
                    <span class="option-text">{{ option.text }}</span>
                </div>
            </div>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';

type OptionType = {
    no: number;
    text: string;
    color?: string;
    image?: Blob | string | null;
    imageUrl?: string | null;
};

const props = defineProps<{
    option: OptionType;
    index: number;
    ariaLabel?: string;
}>();

const emit = defineEmits<(e: 'select', payload: number | undefined) => void>();

const blobUrl = ref<string | null>(null);

const ariaLabel = computed(() => props.ariaLabel || props.option.text || `option-${props.index + 1}`);

const imageUrl = computed(() => {
    if (props.option.imageUrl) return props.option.imageUrl;
    const img = props.option.image;
    if (!img) return '';
    if (typeof img === 'string') return img;
    // Blob -> createObjectURL (cache in blobUrl)
    if (blobUrl.value) {
        URL.revokeObjectURL(blobUrl.value);
        blobUrl.value = null;
    }
    try {
        blobUrl.value = URL.createObjectURL(img as Blob);
        return blobUrl.value;
    } catch {
        return '';
    }
});

onUnmounted(() => {
    if (blobUrl.value) {
        try { URL.revokeObjectURL(blobUrl.value); } catch { }
        blobUrl.value = null;
    }
});

const styleVars = computed(() => ({ '--option-color': props.option.color || 'var(--option-color, #334155)' }));

const onSelect = () => {
    emit('select', props.index);
};
</script>

<style scoped>
.option-card {
    width: 100%;
}

.option-button {
    width: 100%;
    padding: 0;
    border-radius: 16px;
    border: none;
    cursor: pointer;
    color: #fff;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.04), rgba(0, 0, 0, 0.06));
    box-shadow: 0 18px 40px rgba(2, 6, 23, 0.55);
    transition: transform 180ms ease, box-shadow 180ms ease, filter 180ms ease;
    font-weight: 900;
    text-align: left;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
}

.image-wrapper {
    position: relative;
    width: 100%;
    display: block;
    overflow: hidden;
    border-radius: 16px;
    aspect-ratio: 11/5;
    background: var(--option-color, #334155);
}

.option-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    transform-origin: center;
    transition: transform 250ms ease;
    background-color: transparent;
}

.option-index {
    position: absolute;
    top: 12px;
    left: 12px;
    min-width: 56px;
    height: 56px;
    border-radius: 999px;
    background: var(--option-color, rgba(255, 255, 255, 0.12));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 1.05rem;
    box-shadow: 0 8px 18px rgba(2, 6, 23, 0.5);
    z-index: 3;
}

.text-ribbon {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
}

.option-text {
    font-size: 1rem;
    color: #fff;
    font-weight: 800;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 56px);
    padding: 6px 8px;
}
</style>
