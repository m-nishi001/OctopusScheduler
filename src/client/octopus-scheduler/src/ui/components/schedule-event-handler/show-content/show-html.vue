<template>
    <div class="fullscreen-html">
        <div class="html-content" v-html="htmlContent"></div>
        <button @click="onClose" class="close-btn main-btn">
            <span class="btn-icon">❌</span> 閉じる
        </button>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

interface Props {
    content: string;
}

const props = defineProps<Props>();
const router = useRouter();

const htmlContent = ref('');

const onClose = () => {
    router.back();
};

onMounted(() => {
    htmlContent.value = decodeURIComponent(props.content || '');
});
</script>

<style scoped>
.fullscreen-html {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.9);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 9999;
    color: white;
}

.html-content {
    max-width: 90vw;
    max-height: 80vh;
    overflow: auto;
}

.close-btn {
    margin-top: 1rem;
}
</style>