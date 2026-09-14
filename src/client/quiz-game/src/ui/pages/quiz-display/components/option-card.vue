<template>
    <div :class="['option-card', variantClass]" role="listitem">
        <button class="option-button" :style="styleVars" @click="onSelect" :aria-label="ariaLabel">
            <div class="image-wrapper">
                <img v-if="imageUrl" :src="imageUrl" :alt="option.text" class="option-image" />
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
    image?: Blob | null;
    imageUrl?: string | null;
};

const props = defineProps<{
    option: OptionType;
    index: number;
    ariaLabel?: string;
    variant?: string;
}>();

const emit = defineEmits<(e: 'select', payload: number | undefined) => void>();

const blobUrl = ref<string | null>(null);

const optionText = computed(() => (props.option && (props.option.text ?? (props.option.no != null ? String(props.option.no) : ''))) || '');

const displayText = computed(() => {
    if (optionText.value && optionText.value.length > 0) return optionText.value;
    if (props.option && props.option.no != null) return String(props.option.no);
    return String(props.index + 1);
});

const ariaLabel = computed(() => props.ariaLabel || optionText.value || `option-${props.index + 1}`);

const variantClass = computed(() => (props.variant ? `option-card--${props.variant}` : ''));

const imageUrl = computed(() => {
    if (props.option.imageUrl) return props.option.imageUrl;
    const img = props.option.image;
    if (!img) return '';
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
    height: 100%;
}

.option-button {
    width: 100%;
    height: 100%;
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
    /* allow the wrapper to flex to the card height computed by parent */
    flex: 1 1 auto;
    min-height: 0;
    aspect-ratio: auto;
    background: var(--option-color, #334155);
}

.option-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transform-origin: center;
    transition: transform 250ms ease;
    background-color: transparent;
}

.option-index {
    position: absolute;
    top: 12px;
    left: 12px;
    min-width: 44px;
    height: 44px;
    border-radius: 999px;
    background: var(--option-color, rgba(255, 255, 255, 0.12));
    color: #fff;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.85rem;
    padding: 0 10px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    box-shadow: 0 8px 18px rgba(2, 6, 23, 0.5);
    z-index: 3;
}

.text-ribbon {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 10px 12px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6));
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 2;
}

.option-text {
    font-size: 1.5rem;
    color: #fff;
    font-weight: 800;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: calc(100% - 16px);
    padding: 6px 8px;
}

@media (max-width: 480px) {
    .text-ribbon {
        padding: 10px 12px;
    }

    .option-text {
        font-size: 1.05rem;
        padding: 4px 6px;
    }
}
</style>

<style scoped>
@media (min-width: 1024px) {
    .image-wrapper {
        /* slightly less extreme horizontal aspect to improve vertical filling */
        aspect-ratio: 16/9;
    }

    .option-image {
        /* fill the card area on desktop - may crop edges but reduces blank space */
        object-fit: cover;
    }
}
</style>

<style scoped>
/* Styles for OptionCard variants (e.g. large view used on answer screen) */
.option-card--large {
    margin: 0 auto;
    max-width: 1100px;
}

@media (min-width: 1024px) {
    .option-card--large .image-wrapper {
        aspect-ratio: 16/9;
        /* leave room for header/title/padding (approx) */
        max-height: calc(100vh - 220px);
    }

    .option-card--large .option-image {
        object-fit: cover;
        height: 100%;
        width: 100%;
    }
}
</style>
