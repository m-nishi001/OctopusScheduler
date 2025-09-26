<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">オープニング</h2>
      <button @click="$router.push('/description')"
        class="bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">次へ</button>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import MainLayout from '../common/MainLayout.vue';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
export default {
  name: 'Opening',
  components: { MainLayout },
  setup() {
    // 仮のScreenConfig（設計書準拠）
    const screenConfig: ScreenConfig = {
      type: 'opening',
      bgmAssetId: 'asset_bgm_opening',
      seAssetIds: ['asset_se_scroll', 'asset_se_fade'],
      backgroundStyle: 'linear-gradient(to right, #a5b4fc, #f9a8d4)',
      elements: [
        { id: 'title', type: 'text', content: 'オープニング' },
        { id: 'nextBtn', type: 'button', content: '次へ' }
      ],
      animationSettings: {
        type: 'scroll',
        duration: 2.0,
        params: { direction: 'up' }
      }
    };
    return { screenConfig };
  },
};
</script>
