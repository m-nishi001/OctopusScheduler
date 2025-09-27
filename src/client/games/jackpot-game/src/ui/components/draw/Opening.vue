<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <transition-group name="scroll-up" tag="div">
        <div v-for="el in visibleElements" :key="el.id" :class="el.style" class="scroll-item">
          <template v-if="el.type === 'text'">
            <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">{{ el.content }}</h2>
          </template>
          <template v-if="el.type === 'image'">
            <img :src="el.assetId" class="mx-auto mb-4" />
          </template>
        </div>
      </transition-group>
      <button @click="goNext"
        class="bg-gradient-to-r from-indigo-400 to-purple-400 text-white font-semibold px-6 py-3 rounded-lg shadow hover:scale-105 transition">次へ</button>
    </div>
  </MainLayout>
</template>
<script lang="ts">
import { ref, onMounted } from 'vue';
import MainLayout from '../common/MainLayout.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfig } from '../../../model/domains/screen-config/ScreenConfig';
import { ScreenConfigService } from '../../../model/applications/ScreenConfigService';
export default {
  name: 'Opening',
  components: { MainLayout },
  setup() {
    // ScreenConfigServiceから取得
    const screenConfig = ref<ScreenConfig | null>(null);
    const screenConfigService = new ScreenConfigService();
    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('opening');
      showNext();
      setTimeout(playBGM, 1200);
    });

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!screenConfig.value?.bgmAssetId) return;
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio(`/assets/bgm/${screenConfig.value.bgmAssetId.replace('asset_bgm_', '')}.mp3`);
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };

    // SE再生
    const playSE = (seType: string) => {
      if (!screenConfig.value?.seAssetIds) return;
      // seType: 'scroll' or 'fade' など
      const assetId = screenConfig.value.seAssetIds.find(id => id.includes(seType));
      if (!assetId) return;
      const seAudio = new Audio(`/assets/se/${assetId.replace('asset_se_', '')}.mp3`);
      seAudio.play();
    };

    // スクロールアニメーション要素表示
    const visibleElements = ref<ScreenConfig['elements']>([]);
    let idx = 0;
    const showNext = () => {
      if (!screenConfig.value) return;
      if (idx < screenConfig.value.elements.length) {
        visibleElements.value.push(screenConfig.value.elements[idx]);
        playSE('scroll');
        idx++;
        setTimeout(showNext, 1000);
      }
    };

    // 次へボタン
    const router = useRouter();
    const goNext = () => {
      playSE('fade');
      router.push('/description');
    };

    return { screenConfig, visibleElements, goNext };
  },
};
</script>
