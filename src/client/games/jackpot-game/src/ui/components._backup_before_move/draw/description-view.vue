<template>
    <MainLayout>
        <div class="description-container">
            <h2>説明画面</h2>
            <div class="slide" v-for="(slide, index) in slides" :key="index" v-show="currentSlide === index">
                <p>{{ slide.content }}</p>
            </div>
            <p>Enterキーで次へ</p>
        </div>
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';

export default {
    name: 'DescriptionView',
    components: { MainLayout },
    setup() {
        const router = useRouter();
        const currentSlide = ref(0);
        const slides = ref([
            { content: '抽選の進め方を説明します。' },
            { content: 'Enterキーで画面を進めます。' },
            { content: '楽しんでください！' }
        ]);

        const handleEnter = (e: KeyboardEvent) => {
            if (e.key === 'Enter') {
                if (currentSlide.value < slides.value.length - 1) {
                    currentSlide.value++;
                } else {
                    router.push('/jackpot-demo');
                }
            }
        };

        onMounted(() => {
            document.addEventListener('keydown', handleEnter);
        });

        return { currentSlide, slides };
    },
};
</script>

<style scoped>
.description-container {
    text-align: center;
    color: #fff;
}

.slide {
    font-size: 1.5em;
    margin: 50px 0;
}
</style>