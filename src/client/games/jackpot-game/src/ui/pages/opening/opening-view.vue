<template>
  <MainLayout :fullScreen="true">
    <OpeningHtml v-if="screenConfig && isHtmlFullscreen" :element="htmlElement" :bgm="bgm" />
    <OpeningSequence v-else-if="screenConfig" :screenConfig="screenConfig" />
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import OpeningSequence from './opening-sequence.vue';
import OpeningHtml from './opening-html.vue';
import { container } from 'tsyringe';
import { ScreenConfigRepository } from '../../../model/infrastructures/repositories/screen-config-repository';

export default {
  name: 'OpeningView',
  components: { MainLayout, OpeningSequence, OpeningHtml },
  setup() {
    const screenConfigRepo = container.resolve(ScreenConfigRepository);
    const screenConfig = ref<any | null>(null);
    const bgm = ref<HTMLAudioElement | null>(null);

    const isHtmlFullscreen = ref(false);
    const htmlElement = ref<any | null>(null);

    onMounted(async () => {
      screenConfig.value = await screenConfigRepo.getScreenConfigById('opening');

      if (screenConfig.value?.bgmAssetUrl) {
        bgm.value = new Audio(screenConfig.value.bgmAssetUrl);
        bgm.value.loop = true;
        setTimeout(() => bgm.value?.play().catch(() => { }), 500);
      }

      const htmlEl = screenConfig.value?.elements?.find((e: any) => e.type === 'html');
      if (screenConfig.value?.displayMode === 'html' && htmlEl) {
        isHtmlFullscreen.value = true;
        htmlElement.value = htmlEl;
      }
    });

    onUnmounted(() => {
      if (bgm.value) {
        try { bgm.value.pause(); } catch (e) { }
        bgm.value = null;
      }
    });

    return { screenConfig, isHtmlFullscreen, htmlElement, bgm };
  }
};
</script>

<style scoped>
/* keep layout concerns in child components */
</style>
