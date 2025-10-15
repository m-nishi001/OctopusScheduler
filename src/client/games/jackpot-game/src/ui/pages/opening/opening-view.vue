<template>
  <MainLayout :fullScreen="true">
    <OpeningHtml v-if="openingConfig && isHtmlFullscreen" :element="htmlElement" :bgm="bgm" />
    <OpeningSequence v-else-if="openingConfig" :screenConfig="openingConfig" />
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import OpeningSequence from './opening-sequence.vue';
import OpeningHtml from './opening-html.vue';
import { container } from 'tsyringe';
import { ScreenConfigService } from '../../../model/applications/screen-config/screen-config-service';
import { AssetService } from '../../../model/applications/asset/asset-service';
import { OpeningScreenSetting } from '../../../model/domains/screen-config/opening-screen-setting';

export default {
  name: 'OpeningView',
  components: { MainLayout, OpeningSequence, OpeningHtml },
  setup() {
    const screenConfigService = container.resolve(ScreenConfigService);
    const openingConfig = ref<OpeningScreenSetting | null>(null);
    const bgm = ref<HTMLAudioElement | null>(null);

    const isHtmlFullscreen = ref(false);
    const htmlElement = ref<any | null>(null);

    onMounted(async () => {
      // Sync screen configs from server
      await screenConfigService.syncScreenConfigs();

      const config = await screenConfigService.fetchScreenConfig('opening');
      openingConfig.value = config as OpeningScreenSetting ?? new OpeningScreenSetting();

      if (openingConfig.value?.bgmAssetId) {
        const assetService = container.resolve(AssetService);
        const assetDto = await assetService.getAssetById(openingConfig.value.bgmAssetId);
        const url = assetDto?.dataUrl;
        bgm.value = new Audio(url);
        bgm.value.loop = true;
        bgm.value.play().catch(() => { });
      }

      const htmlEl = openingConfig.value?.contents?.find((e: any) => e.type === 'html');
      if (htmlEl) {
        isHtmlFullscreen.value = true;
        htmlElement.value = htmlEl;
      }

      // Resolve asset URLs for contents
      if (openingConfig.value?.contents) {
        const assetService = container.resolve(AssetService);
        for (const content of openingConfig.value.contents) {
          if (content.assetId) {
            try {
              const assetDto = await assetService.getAssetById(content.assetId);
              (content as any).assetUrl = assetDto?.dataUrl;
            } catch (e) {
              console.warn('Failed to load asset for content:', content, e);
            }
          }
        }
      }
    });

    onUnmounted(() => {
      if (bgm.value) {
        try { bgm.value.pause(); } catch (e) { }
        bgm.value = null;
      }
    });

    return { openingConfig, isHtmlFullscreen, htmlElement, bgm };
  }
};
</script>

<style scoped>
/* keep layout concerns in child components */
</style>
