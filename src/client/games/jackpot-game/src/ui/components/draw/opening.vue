<template>
  <MainLayout>
    <div class="w-full max-w-xl mx-auto text-center bg-white/80 rounded-xl shadow-lg p-8">
      <transition-group name="scroll-up" tag="div">
        <div v-for="el in visibleElements" :key="el.id" :class="el.style" class="scroll-item">
          <template v-if="el.type === 'text'">
            <h2 class="text-2xl font-bold text-indigo-700 mb-6 drop-shadow">{{ el.content }}</h2>
          </template>
          <template v-if="el.type === 'image'">
            <img :src="el.assetUrl" class="mx-auto mb-4" />
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
import MainLayout from '../common/main-layout.vue';
import { useRouter } from 'vue-router';
import type { ScreenConfigDto } from '../../../model/applications/dto/screen-config-dto';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';
import { container } from 'tsyringe';
export default {
  name: 'Opening',
  components: { MainLayout },
  setup() {
    // ScreenConfigServiceから取得
    const screenConfig = ref<ScreenConfigDto | null>(null);
    const screenConfigService = container.resolve(ScreenConfigService);
    onMounted(async () => {
      screenConfig.value = await screenConfigService.fetchScreenConfig('opening');
      showNext();
      setTimeout(playBGM, 1200);
    });

    // BGM/SE制御
    const bgmAudio = ref<HTMLAudioElement | null>(null);
    const playBGM = () => {
      if (!screenConfig.value?.bgmAssetUrl) return;
      if (!bgmAudio.value) {
        bgmAudio.value = new Audio(screenConfig.value.bgmAssetUrl);
        bgmAudio.value.loop = true;
      }
      bgmAudio.value.play();
    };

    // SE再生
    const playSE = (seType: string) => {
      if (!screenConfig.value?.seAssetUrls) return;
      // seType: 'scroll' or 'fade' など
      const assetUrl = screenConfig.value.seAssetUrls.find(url => url.includes(seType));
      if (!assetUrl) return;
      const seAudio = new Audio(assetUrl);
      seAudio.play();
    };

    // スクロールアニメーション要素表示
    const visibleElements = ref<ScreenConfigDto['elements']>([]);
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
