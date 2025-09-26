<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">本抽選画面</h2>
      <button @click="$router.push('/result')"
        class="bg-gradient-to-r from-pink-400 to-yellow-300 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">結果へ</button>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
export default {
  name: 'MainDraw',
  components: { MainLayout },
  setup() {
    // 仮のScreenConfig（設計書準拠）
    const screenConfig: ScreenConfig = {
      type: 'main',
      bgmAssetId: 'asset_bgm_main',
      seAssetIds: ['asset_se_draw', 'asset_se_result'],
      backgroundStyle: 'linear-gradient(to right, #a5b4fc, #fef08a)',
      elements: [
        { id: 'title', type: 'text', content: '本抽選画面' },
        { id: 'resultBtn', type: 'button', content: '結果へ' }
      ],
      animationSettings: {
        type: 'particle',
        duration: 2.0,
        params: { effect: 'firework' }
      }
    };
    return { screenConfig };
  },
};
</script>
