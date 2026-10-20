<template>
    <MainLayout :fullScreen="true">
        <Loader v-if="!screenConfig" label="読み込み中..." />
        <OpeningSequence v-if="screenConfig" :screenConfig="screenConfig" :bgm="bgm" :autoNavigate="isDemo"
            :nextRoute="'/jackpot-admin'" @finished="onFinished" />
    </MainLayout>
</template>

<script lang="ts">
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import OpeningSequence from '../opening/opening-sequence.vue';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import { useEndingExit } from '../../composables/use-ending-exit';
import { useScreenMedia } from '../../composables/use-screen-media';

/** 画面が出てから BGM を鳴らし始めるまでの待ち（ミリ秒）。 */
const BGM_DELAY_MS = 500;

export default {
    name: 'EndingView',
    components: { MainLayout, Loader, OpeningSequence },
    setup() {
        // エンディングを最後まで表示し終えたら、本番(ホスト)はロビーへ戻る。デモは設定画面へ戻る。
        const { isDemo } = useJackpotSession();
        const { exitToLobby } = useEndingExit();
        const onFinished = () => {
            if (!isDemo) exitToLobby();
        };
        // 設定・BGM・画像の準備ができてから画面を出し、BGM を鳴らす。画面を離れたら止めて、後始末する。
        const { config: screenConfig, bgm } = useScreenMedia({
            screenName: 'ending',
            settingName: 'ending-screen-settings',
            fallback: () => ({ bgmAssetId: '', contents: [] }),
            bgmDelayMs: BGM_DELAY_MS,
        });
        return { screenConfig, bgm, isDemo, onFinished };
    }
};
</script>

<style scoped></style>
