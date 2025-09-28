<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">デモ抽選画面</h2>
      <div v-if="!drawn">
        <button @click="runDemoDraw"
          class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">抽選開始</button>
        <p class="mt-4 text-gray-700">抽選ボタンを押すと1回だけデモ抽選を実施します</p>
      </div>
      <div v-else>
        <transition name="fade">
          <div class="result-box" v-if="result">
            <h3 class="text-xl font-bold text-pink-600 mb-2">当選者: {{ result.member }}</h3>
            <p class="text-lg text-indigo-700">賞品: {{ result.prize }}</p>
            <p class="mt-4 text-green-700 font-bold">では本番です！！（Enterキーで本抽選へ）</p>
          </div>
        </transition>
      </div>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfig } from '../../../model/domains/screen-config/screen-config';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';
export default {
  name: 'DemoDraw',
  components: { MainLayout },
  setup() {
    const router = useRouter();
    // ScreenConfigServiceから取得
    const screenConfig = ref<ScreenConfig | null>(null);
    const screenConfigService = new ScreenConfigService();
    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('demo');
      setTimeout(playBGM, 1200);
    });

    // 仮のメンバー・賞品リスト
    const members = ['山田太郎', '佐藤花子', '鈴木一郎'];
    const prizes = ['豪華景品A', '参加賞B', '特別賞C'];

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio('/assets/bgm/demo_bgm.mp3');
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };
    onMounted(() => {
      setTimeout(playBGM, 1200);
    });

    const playSE = (se: string) => {
      const seAudio = new Audio(`/assets/se/${se}.mp3`);
      seAudio.play();
    };

    // 抽選ロジック
    const drawn = ref(false);
    const result = ref<{ member: string; prize: string } | null>(null);
    const runDemoDraw = () => {
      if (drawn.value) return;
      playSE('draw');
      // ランダム抽選
      const member = members[Math.floor(Math.random() * members.length)];
      const prize = prizes[Math.floor(Math.random() * prizes.length)];
      setTimeout(() => {
        result.value = { member, prize };
        drawn.value = true;
      }, 1200); // 演出用ディレイ
    };

    // Enterキーで本抽選へ
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && drawn.value) {
        router.push('/main-draw');
      }
    };
    onMounted(() => window.addEventListener('keydown', handleKey));
    onUnmounted(() => window.removeEventListener('keydown', handleKey));

    return { screenConfig, runDemoDraw, drawn, result };
  },
};
</script>
