<template>
  <MainLayout>
    <div class="opening-container" ref="container">
      <div class="scroll-content" ref="scrollContent">
        <div class="content-item">2025年度 ジャックポッド大会</div>
        <div class="content-item">主催: 株式会社Example</div>
        <div class="content-item">参加者: 山田太郎, 佐藤花子, ...</div>
        <div class="content-item">景品: 豪華賞品A, B, ...</div>
        <div class="content-item">楽しんでください！</div>
      </div>
      <p class="instruction">Enterキーで次へ</p>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import gsap from 'gsap';

export default {
  name: 'OpeningView',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    const container = ref<HTMLElement | null>(null);
    const scrollContent = ref<HTMLElement | null>(null);

    const startScroll = () => {
      if (scrollContent.value) {
        gsap.to(scrollContent.value, {
          y: -window.innerHeight,
          duration: 10,
          ease: 'none',
          onComplete: () => {
            router.push('/jackpot-description');
          }
        });
      }
    };

    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        router.push('/jackpot-description');
      }
    };

    onMounted(() => {
      startScroll();
      document.addEventListener('keydown', handleEnter);
    });

    return { container, scrollContent };
  },
};
</script>

<style scoped>
.opening-container {
  height: 100vh;
  overflow: hidden;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.scroll-content {
  text-align: center;
  color: #fff;
  font-size: 2em;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.content-item {
  margin: 50px 0;
}

.instruction {
  position: absolute;
  bottom: 20px;
  color: #fff;
  font-size: 1.2em;
}
</style>
