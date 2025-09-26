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
import MainLayout from '../common/MainLayout.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
export default {
  name: 'Home',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    const autoNavigate = ref(false);
    const goOpening = () => router.push('/jackpot-opening');
    const goAdmin = () => router.push('/jackpot-admin');

    // 仮のScreenConfig（設計書準拠）
    const screenConfig: ScreenConfig = {
      type: 'home',
      bgmAssetId: 'asset_bgm_home',
      seAssetIds: ['asset_se_start', 'asset_se_admin'],
      backgroundStyle: 'linear-gradient(to right, #f9a8d4, #fef08a)',
      elements: [
        { id: 'title', type: 'text', content: '2025年度 ジャックポッド大会！' },
        { id: 'progress', type: 'progress' },
        { id: 'startBtn', type: 'button', content: 'スタート' },
        { id: 'adminBtn', type: 'button', content: '管理画面' }
      ],
      animationSettings: {
        type: 'fade',
        duration: 1.0,
        params: { scale: 1.2 }
      }
    };

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
    return { goOpening, goAdmin, autoNavigate, screenConfig };
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
