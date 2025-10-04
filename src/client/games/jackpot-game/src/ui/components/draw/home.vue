<template>
  <MainLayout>
    <div class="home-container">
      <h1 class="home-title">2025年度 ジャックポッド大会！</h1>

      <div v-if="!assetsLoaded" class="progress-container">
        <div class="progress-bar" :style="{ width: progress + '%' }"></div>
        <p>アセットをダウンロード中... {{ Math.round(progress) }}%</p>
      </div>

      <div class="actions">
        <button v-if="assetsLoaded" @click="goOpening" class="start-button">スタート</button>
        <button @click="goAdmin" class="admin-button">管理画面</button>
      </div>

      <div class="auto-navi mt-4">
        <label>
          <input type="checkbox" v-model="autoNavigate" />
          自動遷移（3秒後にスタート）
        </label>
      </div>
    </div>
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfigDto } from '../../../model/applications/dto/screen-config-dto';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';
import { container } from 'tsyringe';
import { Container } from '../../../core/container';

export default {
  name: 'Home',
  components: { MainLayout },
  setup() {
    Container.register();

    const router = useRouter();
    const autoNavigate = ref(false);
    const goOpening = () => router.push('/jackpot-opening');
    const goAdmin = () => router.push('/jackpot-admin');

    const screenConfig = ref<ScreenConfigDto | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);

    const assetsLoaded = ref(false);
    const progress = ref(0);

    const loadAssets = async () => {
      try {
        progress.value = 10;
        await screenConfigService.syncScreenConfigs(['home', 'opening']);
        progress.value = 40;
      } catch (e) {
        progress.value = 50;
      }
      screenConfig.value = await screenConfigService.fetchScreenConfig('home');

      // simulate asset download progress
      for (let i = progress.value; i <= 100; i += 10) {
        progress.value = i;
        await new Promise((r) => setTimeout(r, 150));
      }
      assetsLoaded.value = true;
    };

    onMounted(() => {
      loadAssets();
      window.addEventListener('keydown', handleKey);
    });
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKey);
    });

    // BGM control
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!screenConfig.value?.bgmAssetUrl) return;
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio(screenConfig.value.bgmAssetUrl);
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };
    watch(progress, (val) => {
      if (val === 100) playBGM();
    });

    // Enterキーでスタート
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') goOpening();
    };

    // auto navigate
    let autoTimer: number | undefined;
    watch(autoNavigate, (val) => {
      if (val) {
        autoTimer = window.setTimeout(goOpening, 3000);
      } else {
        if (autoTimer) window.clearTimeout(autoTimer);
      }
    });

    return { goOpening, goAdmin, autoNavigate, screenConfig, progress, assetsLoaded };
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
  margin-bottom: 24px;
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

.actions {
  margin-bottom: 18px;
}

.start-button {
  margin-bottom: 12px;
  padding: 10px 20px;
  border-radius: 8px;
  background: linear-gradient(90deg, #ff7a7a, #ffd26f);
  color: #fff;
  border: none;
}

.admin-button {
  opacity: 0.8;
  padding: 8px 16px;
  border-radius: 6px;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border: none;
}

.auto-navi {
  margin-bottom: 1em;
  text-align: center;
  color: #fff;
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
