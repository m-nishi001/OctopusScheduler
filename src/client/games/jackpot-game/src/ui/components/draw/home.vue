<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h1 class="text-3xl font-bold text-indigo-700 mb-6 drop-shadow">2025年度 ジャックポッド大会！</h1>
      <div class="flex flex-col gap-4 items-center">
        <button @click="goOpening"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">スタート</button>
        <button @click="goAdmin"
          class="bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">管理画面</button>
      </div>
      <ProgressBar :percent="progress" label="ダウンロード進捗" />
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
import ProgressBar from './progress-bar.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfig } from '../../../model/domains/screen-config/screen-config';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';
import { container } from 'tsyringe';
export default {
  name: 'Home',
  components: { MainLayout, ProgressBar },
  setup() {
    const router = useRouter();
    const autoNavigate = ref(false);
    const goOpening = () => router.push('/jackpot-opening');
    const goAdmin = () => router.push('/jackpot-admin');

    // ScreenConfigServiceから取得
    const screenConfig = ref<ScreenConfig | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('home');
    });

    // プログレスバー進捗（仮: 0→100%を2秒でアニメーション）
    const progress = ref(0);
    onMounted(() => {
      let p = 0;
      const timer = setInterval(() => {
        p += 5;
        progress.value = p;
        if (p >= 100) clearInterval(timer);
      }, 100);
    });

    // BGM/SE制御（DL完了後再生開始）
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!screenConfig.value?.bgmAssetId) return;
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio(`/assets/bgm/${screenConfig.value.bgmAssetId.replace('asset_bgm_', '')}.mp3`);
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };
    watch(progress, (val) => {
      if (val === 100) playBGM();
    });

    // SE再生関数（未使用のため削除）

    // Enterキーでスタート
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') goOpening();
    };
    onMounted(() => {
      window.addEventListener('keydown', handleKey);
    });
    onUnmounted(() => {
      window.removeEventListener('keydown', handleKey);
    });

    // 自動遷移
    let autoTimer: number | undefined;
    watch(autoNavigate, (val) => {
      if (val) {
        autoTimer = window.setTimeout(goOpening, 3000);
      } else {
        if (autoTimer) window.clearTimeout(autoTimer);
      }
    });
  return { goOpening, goAdmin, autoNavigate, screenConfig, progress };
  },
};
</script>
<style scoped>

.auto-navi {
  margin-bottom: 1em;
  text-align: center;
  color: #444;
}
</style>
