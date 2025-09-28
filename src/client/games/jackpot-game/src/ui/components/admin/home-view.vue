<template>
  <MainLayout>
    <div class="home-container">
      <h1 class="home-title">2025年度 ジャックポッド大会！</h1>
      <div v-if="!assetsLoaded" class="progress-container">
        <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        <p>アセットをダウンロード中... {{ Math.round(progress) }}%</p>
      </div>
      <Button v-if="assetsLoaded" @click="goOpening" class="start-button">スタート</Button>
      <Button @click="goAdmin" class="admin-button">管理画面</Button>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import Button from '../common/button.vue';
import { useRouter } from 'vue-router';

export default {
  name: 'HomeView',
  components: { MainLayout, Button },
  setup() {
    const router = useRouter();
    const assetsLoaded = ref(false);
    const progress = ref(0);

    const loadAssets = async () => {
      // Simulate asset loading
      for (let i = 0; i <= 100; i += 10) {
        progress.value = i;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      assetsLoaded.value = true;
    };

    onMounted(() => {
      loadAssets();
    });

    const goAdmin = () => router.push('/jackpot-admin');
    const goOpening = () => router.push('/jackpot-opening');

    return { assetsLoaded, progress, goAdmin, goOpening };
  },
};
</script>

<style scoped>
.home-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
}

.home-title {
  font-size: 3em;
  color: #fff;
  text-shadow: 0 2px 16px #2a5298;
  margin-bottom: 40px;
  animation: titleAnimation 2s ease-in-out;
}

@keyframes titleAnimation {
  0% {
    transform: scale(0.8);
    opacity: 0;
  }

  100% {
    transform: scale(1);
    opacity: 1;
  }
}

.progress-container {
  margin-bottom: 40px;
}

.progress-bar {
  width: 300px;
  height: 20px;
  background: #232b36;
  border-radius: 10px;
  overflow: hidden;
  margin-bottom: 10px;
}

.progress-bar::after {
  content: '';
  display: block;
  height: 100%;
  background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
  transition: width 0.2s;
}

.start-button {
  margin-bottom: 20px;
  animation: fadeIn 1s ease-in-out;
}

.admin-button {
  opacity: 0.7;
}

@keyframes fadeIn {
  0% {
    opacity: 0;
    transform: translateY(20px);
  }

  100% {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
