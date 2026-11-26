<template>
    <div :class="['option-card', variantClass, { 'option-card--with-image': imageUrl }]" role="listitem">
        <button class="option-button" :style="styleVars" @click="onSelect" :aria-label="ariaLabel">
            <div ref="frameEl" class="image-wrapper">
                <img v-if="imageUrl" :src="imageUrl" :alt="option.text" class="option-image" />
                <div class="text-ribbon">
                    <span ref="textEl" class="option-text" :class="`size-${textSize}`">{{ option.text }}</span>
                </div>
            </div>
        </button>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, onUnmounted } from 'vue';
import { optionSizeOf } from '../../model/option-size';
import { useFitText } from '../composables/use-fit-text';

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

const textSize = computed(() => optionSizeOf(props.option.text ?? ''));

// 選択肢は省略しない。段階の大きさで枠に入らないときは、入るまで文字を縮める。
const frameEl = ref<HTMLElement | null>(null);
const textEl = ref<HTMLElement | null>(null);
useFitText(frameEl, textEl, () => [props.option.text, imageUrl.value, props.variant]);

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

/* 下端に固定し、行が増えた分だけ上に伸びる。上限(max-height)を超える分は use-fit-text が文字を縮めて収める。 */
.text-ribbon {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    box-sizing: border-box;
    max-height: 100%;
    padding: 10px 12px;
    background: linear-gradient(180deg, rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.6));
    /* 縦並びにして、上限を超えたら中の文字の枠も一緒に縮むようにする(はみ出しを測れる) */
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    z-index: 2;
}

/* 画像があるときは、画像を隠しすぎないように帯をカードの高さの 1/3 までにする。 */
.option-card--with-image .text-ribbon {
    max-height: 33.3%;
    padding-block: clamp(2px, 0.6vmin, 10px);
    /* 帯が高くなっても、画像の上で文字が読めるように下地を濃くする */
    background: rgba(0, 0, 0, 0.62);
}

.option-text {
    /* 段階(--option-scale)で小さくし、それでも入らなければ実寸に合わせて縮める(--option-fit)。 */
    --option-scale: 1;
    font-size: calc(var(--option-font-base, clamp(1rem, 4.6vmin, 3.8rem)) * var(--option-scale) * var(--option-fit, 1));
    line-height: 1.25;
    color: #fff;
    font-weight: 800;
    text-align: center;
    text-shadow: 0 2px 8px rgba(0, 0, 0, 0.6);
    box-sizing: border-box;
    width: 100%;
    min-height: 0;
    overflow: hidden;
    overflow-wrap: anywhere;
    text-wrap: balance;
    padding: 0 8px;
}

.option-text.size-medium {
    --option-scale: 0.85;
}

.option-text.size-long {
    --option-scale: 0.7;
}

@media (max-width: 480px) {
    .option-text {
        padding: 0 6px;
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

/* 参加者の回答画面で、現在選択中の選択肢を示す。 */
.option-card--selected .option-button {
    outline: 4px solid #ffd54a;
    outline-offset: 2px;
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
