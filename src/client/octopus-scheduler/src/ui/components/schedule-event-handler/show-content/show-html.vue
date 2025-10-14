<template>
    <div class="fullscreen-html">
        <div class="html-content" v-html="htmlContent" :class="displayModeClass"></div>
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useRoute } from 'vue-router';

interface Props {
    content: string;
}

const props = defineProps<Props>();
const route = useRoute();

const htmlContent = ref('');

const displayMode = ref(route.query.displayMode as string || 'fade');

const displayModeClass = computed(() => {
    return displayMode.value === 'fade' ? 'fade-in' : displayMode.value;
});

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

.fade-in {
    animation: fadeIn 1.2s;
}

.scroll-up {
    animation: scrollUp 3s linear forwards;
}

.scroll-down {
    animation: scrollDown 3s linear forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes scrollUp {
    from {
        transform: translateY(100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}

@keyframes scrollDown {
    from {
        transform: translateY(-100%);
        opacity: 0;
    }

    to {
        transform: translateY(0);
        opacity: 1;
    }
}
</style>