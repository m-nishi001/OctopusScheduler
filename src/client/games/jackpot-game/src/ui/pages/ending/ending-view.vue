<template>
    <MainLayout :fullScreen="true">
        <!-- Always render the sequence so ending contents display in configured order.
             Convert `screenConfig.elements` (ending shape) to `contents` expected by OpeningSequence. -->
        <OpeningSequence v-if="screenConfig" :screenConfig="convertedConfig" :bgm="bgm" />
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import OpeningSequence from '../opening/opening-sequence.vue';
import OpeningHtml from '../opening/opening-html.vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '../../../model/applications/screen-config/screen-settings-service';
import { EndingScreenSetting } from '../../../model/domains/screen-config/ending-screen-setting';

export default {
    name: 'EndingView',
    components: { MainLayout, OpeningSequence, OpeningHtml },
    setup() {
        const screenSettingsService = container.resolve(ScreenSettingsService);
        const screenConfig = ref<any | null>(null);
        const bgm = ref<HTMLAudioElement | null>(null);

        const isHtmlFullscreen = ref(false);
        const htmlElement = ref<any | null>(null);

        // Convert ending screen config shape to the shape OpeningSequence expects.
        const convertedConfig = {
            get value() {
                // If original screenConfig uses `contents`, prefer it; otherwise use `elements`.
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

<style scoped>
/* keep layout concerns in child components */
</style>