<template>
    <MainLayout :fullScreen="true">
        <Loader v-if="!screenConfig" label="読み込み中..." />
        <SequencePlayer v-if="screenConfig" :config="screenConfig" :autoNavigate="isDemo"
            :nextRoute="'/jackpot-admin'" @finished="onFinished" />
    </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import SequencePlayer from '../sequence/sequence-player.vue';
import { parseSequenceSettings } from '@model/screen-config/sequence-setting';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import { useJackpotFinale } from '../../composables/use-jackpot-finale';
import { useEndingExit } from '../../composables/use-ending-exit';
import { useScreenMedia } from '../../composables/use-screen-media';

/** 画面が出てから BGM を鳴らし始めるまでの待ち（ミリ秒）。 */
const BGM_DELAY_MS = 500;

export default {
    name: 'EndingView',
    components: { MainLayout, Loader, SequencePlayer },
    setup() {
        useJackpotFinale();
        // エンディングを最後まで表示し終えたら、本番(ホスト)はロビーへ戻る。デモは設定画面へ戻る。
        const { isDemo } = useJackpotSession();
        const { exitToLobby } = useEndingExit();
        const onFinished = () => {
            if (!isDemo) exitToLobby();
        };
        // 設定・BGM・画像の準備ができてから画面を出し、BGM を鳴らす。画面を離れたら止めて、後始末する。
        const { config: screenConfig } = useScreenMedia({
            screenName: 'ending',
            settingName: 'ending-screen-settings',
            parse: parseSequenceSettings,
            items: (c) => c.items,
            bgmDelayMs: BGM_DELAY_MS,
        });
        return { screenConfig, isDemo, onFinished };
    }
};
</script>

<style scoped></style>
