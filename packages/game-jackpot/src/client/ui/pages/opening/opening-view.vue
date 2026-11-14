<template>
  <MainLayout :fullScreen="true">
    <Loader v-if="!config" label="読み込み中..." />
    <SequencePlayer v-if="config" :config="config" :nextRoute="nextRoute" />
  </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import SequencePlayer from '../sequence/sequence-player.vue';
import { parseSequenceSettings } from '@model/screen-config/sequence-setting';
import { useScreenMedia } from '../../composables/use-screen-media';
import { useOpeningNextRoute } from '../../composables/use-opening-next-route';

export default {
  name: 'OpeningView',
  components: { MainLayout, Loader, SequencePlayer },
  setup() {
    // 設定・BGM・画像・効果音の準備ができてから画面を出し、BGM を鳴らす。画面を離れたら止めて、後始末する。
    const { config } = useScreenMedia({
      screenName: 'opening',
      settingName: 'opening-screen-settings',
      parse: parseSequenceSettings,
      items: (c) => c.items,
    });
    // セッションのホストなら、次は共通のエントリー画面(デモ・単体実行は説明)
    const nextRoute = useOpeningNextRoute();
    return { config, nextRoute };
  }
};
</script>
