<template>
    <MainLayout :fullScreen="true">
        <Loader v-if="!screenConfig" label="読み込み中..." />
        <OpeningSequence v-if="screenConfig" :screenConfig="convertedConfig" :bgm="bgm" :autoNavigate="true"
            :nextRoute="'/jackpot-home'" />
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import Loader from '../common/loader.vue';
import OpeningSequence from '../opening/opening-sequence.vue';
import OpeningHtml from '../opening/opening-html.vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { EndingScreenSetting } from '@model/screen-config/ending-screen-setting';
import { useRemoteScreenSync } from '../../composables/use-remote-screen-sync';

export default {
    name: 'EndingView',
    components: { MainLayout, Loader, OpeningSequence, OpeningHtml },
    setup() {
        useRemoteScreenSync();
        const screenSettingsService = container.resolve(ScreenSettingsService);
        const screenConfig = ref<any | null>(null);
        const bgm = ref<HTMLAudioElement | null>(null);

        const isHtmlFullscreen = ref(false);
        const htmlElement = ref<any | null>(null);

        const convertedConfig = {
            get value() {

                const cfg = screenConfig.value as any;
                if (!cfg) return null;
                return {
                    ...cfg,
                    contents: cfg.contents || cfg.elements || cfg.screenElements || []
                };
            }
        } as any;

        onMounted(async () => {
            const config = await screenSettingsService.fetchScreenSetting('ending', 'ending-screen-settings');
            screenConfig.value = config ?? new EndingScreenSetting("", "", "");

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

        return { screenConfig, isHtmlFullscreen, htmlElement, bgm, convertedConfig };
    }
};
</script>

<style scoped></style>