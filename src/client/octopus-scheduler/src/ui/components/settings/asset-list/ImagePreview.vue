<template>
    <div style="
            display: flex;
            flex-direction: column;
            align-items: center;
        ">
        <img :src="imageUrl" alt="画像プレビュー" style="
                max-width: 80vw;
                max-height: 70vh;
                border-radius: 8px;
                box-shadow: 0 2px 16px #000a;
            " />
        <div v-if="name" style="
                margin-top: 1em;
                color: #8fd3ff;
            ">
            {{ name }}
        </div>
    </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { ref, watch, onUnmounted } from 'vue';

const props = defineProps<{ src: string | Blob; name?: string }>();
const imageUrl = ref<string>('');

let objectUrl: string | null = null;

function updateImageUrl() {
    if (props.src instanceof Blob) {
        if (objectUrl) {
            URL.revokeObjectURL(objectUrl);
        }
        objectUrl = URL.createObjectURL(props.src);
        imageUrl.value = objectUrl;
    } else {
        imageUrl.value = props.src;
    }
}

watch(() => props.src, updateImageUrl, { immediate: true });

onUnmounted(() => {
    if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
    }
});
</script>

<style scoped>
/* 画像プレビュー用のスタイルはtemplate内で直接指定 */
</style>
