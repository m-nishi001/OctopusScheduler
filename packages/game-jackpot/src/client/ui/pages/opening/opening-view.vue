<template>
  <MainLayout :fullScreen="true">
    <Loader v-if="!openingConfig" label="読み込み中..." />
    <OpeningSequence v-if="openingConfig" :screenConfig="openingConfig" :bgm="bgm" />
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import OpeningSequence from './opening-sequence.vue';
import { OpeningScreenSetting } from '@model/screen-config/opening-screen-setting';
import { useScreenMedia } from '../../composables/use-screen-media';

export default {
  name: 'OpeningView',
  components: { MainLayout, Loader, OpeningSequence },
  setup() {
    // 設定・BGM・画像の準備ができてから画面を出し、BGM を鳴らす。画面を離れたら止めて、後始末する。
    const { config: openingConfig, bgm } = useScreenMedia({
      screenName: 'opening',
      settingName: 'opening-screen-settings',
      fallback: () => new OpeningScreenSetting(),
    });
    return { openingConfig, bgm };
  }
};
</script>

<style scoped>

</style>
