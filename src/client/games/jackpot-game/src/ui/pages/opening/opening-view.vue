<template>
  <MainLayout :fullScreen="true">
    
    <OpeningSequence v-if="openingConfig" :screenConfig="openingConfig" :bgm="bgm" />
  </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import OpeningSequence from './opening-sequence.vue';
import OpeningHtml from './opening-html.vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { OpeningScreenSetting } from '@model/domains/screen-config/opening-screen-setting';

export default {
  name: 'OpeningView',
  components: { MainLayout, OpeningSequence, OpeningHtml },
  setup() {
    const screenSettingsService = container.resolve(ScreenSettingsService);
    const openingConfig = ref<OpeningScreenSetting | null>(null);
    const bgm = ref<HTMLAudioElement | null>(null);

    const isHtmlFullscreen = ref(false);
    const htmlElement = ref<any | null>(null);

    let bgmObjectUrl: string | undefined;
    const createdContentUrls: string[] = [];
    onMounted(async () => {
      const config = await screenSettingsService.fetchScreenSetting('opening', 'opening-screen-settings');
      openingConfig.value = (config as OpeningScreenSetting) ?? new OpeningScreenSetting();

      if (openingConfig.value?.bgmAssetId) {
        const assetService = container.resolve(AssetDataService);
        const assetDto = await assetService.getAssetDataById(openingConfig.value.bgmAssetId);
        if (assetDto && assetDto.blob) {
          try {
            bgmObjectUrl = URL.createObjectURL(assetDto.blob);
            bgm.value = new Audio(bgmObjectUrl);
          } catch (e) {
            bgm.value = null;
          }
        }
        if (bgm.value) {
          bgm.value.loop = true;
          bgm.value.play().catch(() => { });
        }
      }

      const htmlEl = openingConfig.value?.contents?.find((e: any) => e.type === 'html');
      if (htmlEl) {
        isHtmlFullscreen.value = true;
        htmlElement.value = htmlEl;
      }

      if (openingConfig.value?.contents) {
        const assetService = container.resolve(AssetDataService);
        for (const content of openingConfig.value.contents) {
          if (content.assetId) {
            try {
              const assetDto = await assetService.getAssetDataById(content.assetId);
              if (assetDto && assetDto.blob) {
                try {
                  const url = URL.createObjectURL(assetDto.blob);
                  (content as any).assetUrl = url;
                  createdContentUrls.push(url);
                } catch (e) { (content as any).assetUrl = undefined; }
              } else {
                (content as any).assetUrl = undefined;
              }
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
      try { if (bgmObjectUrl) URL.revokeObjectURL(bgmObjectUrl); } catch { }
      try { for (const u of createdContentUrls) URL.revokeObjectURL(u); } catch { }
    });

    return { openingConfig, isHtmlFullscreen, htmlElement, bgm };
  }
};
</script>

<style scoped>

</style>
