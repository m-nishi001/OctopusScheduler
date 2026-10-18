<template>
    <MainLayout :fullScreen="true">
        <Loader v-if="!screenConfig" label="読み込み中..." />
        <OpeningSequence v-if="screenConfig" :screenConfig="convertedConfig" :bgm="bgm" :autoNavigate="isDemo"
            :nextRoute="'/jackpot-admin'" @finished="onFinished" />
    </MainLayout>
</template>

<script lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import OpeningSequence from '../opening/opening-sequence.vue';
import OpeningHtml from '../opening/opening-html.vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { AssetDataService } from '@control/asset/asset-data-service';
import { EndingScreenSetting } from '@model/screen-config/ending-screen-setting';
import { useJackpotSession } from '../../composables/use-jackpot-session';
import { useEndingExit } from '../../composables/use-ending-exit';

export default {
    name: 'EndingView',
    components: { MainLayout, Loader, OpeningSequence, OpeningHtml },
    setup() {
        // エンディングを最後まで表示し終えたら、本番(ホスト)はロビーへ戻る。デモは設定画面へ戻る。
        const { isDemo } = useJackpotSession();
        const { exitToLobby } = useEndingExit();
        const onFinished = () => {
            if (!isDemo) exitToLobby();
        };
        const screenSettingsService = container.resolve(ScreenSettingsService);
        const screenConfig = ref<any | null>(null);
        const bgm = ref<HTMLAudioElement | null>(null);

        const isHtmlFullscreen = ref(false);
        const htmlElement = ref<any | null>(null);

        // OpeningSequence は contents を読む。エディタが保存する形(contents)のほか、旧形式(elements / screenElements)も受ける。
        // テンプレートで自動的に展開されるよう computed にする(素のオブジェクトの getter は展開されない)。
        const convertedConfig = computed(() => {
            const cfg = screenConfig.value as any;
            if (!cfg) return null;
            return {
                ...cfg,
                contents: cfg.contents || cfg.elements || cfg.screenElements || []
            };
        });

        let bgmObjectUrl: string | undefined;
        const createdContentUrls: string[] = [];

        onMounted(async () => {
            const config = await screenSettingsService.fetchScreenSetting('ending', 'ending-screen-settings');
            screenConfig.value = config ?? new EndingScreenSetting("", "", "");

            // エディタが保存するのは bgmAssetId なので、オープニングと同じようにアセットから音を読み込む
            const assetService = container.resolve(AssetDataService);
            if (screenConfig.value?.bgmAssetId) {
                const assetDto = await assetService.getAssetDataById(screenConfig.value.bgmAssetId);
                if (assetDto && assetDto.blob) {
                    try {
                        bgmObjectUrl = URL.createObjectURL(assetDto.blob);
                        bgm.value = new Audio(bgmObjectUrl);
                    } catch (e) {
                        bgm.value = null;
                    }
                }
            } else if (screenConfig.value?.bgmAssetUrl) {
                bgm.value = new Audio(screenConfig.value.bgmAssetUrl);
            }
            if (bgm.value) {
                bgm.value.loop = true;
                setTimeout(() => bgm.value?.play().catch(() => { }), 500);
            }

            // 画像コンテンツは assetId から表示用URLを作る(オープニングと同じ)
            for (const content of (convertedConfig.value?.contents ?? []) as any[]) {
                if (!content.assetId) continue;
                try {
                    const assetDto = await assetService.getAssetDataById(content.assetId);
                    if (assetDto && assetDto.blob) {
                        const url = URL.createObjectURL(assetDto.blob);
                        content.assetUrl = url;
                        createdContentUrls.push(url);
                    }
                } catch (e) {
                    console.warn('Failed to load asset for content:', content, e);
                }
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
            try { if (bgmObjectUrl) URL.revokeObjectURL(bgmObjectUrl); } catch { }
            try { for (const u of createdContentUrls) URL.revokeObjectURL(u); } catch { }
        });

        return { screenConfig, isHtmlFullscreen, htmlElement, bgm, convertedConfig, isDemo, onFinished };
    }
};
</script>

<style scoped></style>