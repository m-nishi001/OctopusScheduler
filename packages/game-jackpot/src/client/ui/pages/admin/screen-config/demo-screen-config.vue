<template>
    <div class="admin-section">
        <h2>デモ抽選画面設定</h2>
        <p class="section-hint">説明のあと、本抽選の前に、本番と同じルーレット/スロットで練習として回します。結果は記録も公開もしません(参加者のスマホにも出ません)。OFF にすると、説明から本抽選へそのまま進みます。</p>
        <div class="tab-content">
            <div class="screen-config">
                <div class="config-item">
                    <label class="check-row">
                        <input type="checkbox" data-testid="demo-enabled" :checked="localConfig.enabled"
                            @change="form.set('enabled', ($event.target as HTMLInputElement).checked)" />
                        デモ抽選をする
                    </label>
                </div>
                <div class="config-item">
                    <label class="field-label" for="demo-rounds">回す回数(1〜3回)</label>
                    <select id="demo-rounds" data-testid="demo-rounds" class="admin-input" :value="localConfig.rounds"
                        :disabled="!localConfig.enabled" @change="form.set('rounds', Number(($event.target as HTMLSelectElement).value))">
                        <option v-for="n in ROUNDS" :key="n" :value="n">{{ n }}回</option>
                    </select>
                </div>
                <div class="config-item">
                    <MediaPicker label="BGM(デモ抽選を始めるまで流す)" kind="audio" :model-value="localConfig.bgm"
                        @update:model-value="form.set('bgm', $event)" :options="draft.optionsOf('audio')"
                        :preview-url="draft.urlOf(localConfig.bgm)" @pick="draft.pick" />
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <UiButton @click="handleSaveClick" :disabled="saving">保存</UiButton>
                <div class="status-text">{{ saveStatus }}</div>
            </div>

            <UiBusyOverlay :visible="saving" title="保存中..." :message="saveStatus" />

            <UnsavedChangesDialog :visible="showUnsavedDialog" @discard="handleDiscardChanges"
                @cancel="handleCancelDiscard" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { UiBusyOverlay, UiButton } from '@octopus/ui-kit';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { onBeforeRouteLeave } from 'vue-router';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useMediaDraft } from '@ui/composables/use-media-draft';
import { useFormDraft } from '@ui/composables/use-form-draft';
import MediaPicker from '@ui/components/media-picker.vue';
import { DEFAULT_DEMO_DRAW, MAX_DEMO_ROUNDS, MIN_DEMO_ROUNDS, parseDemoDrawSettings, type DemoDrawSettings } from '@model/screen-config/demo-draw-setting';
import UnsavedChangesDialog from './unsaved-changes-dialog.vue';

const ROUNDS = Array.from({ length: MAX_DEMO_ROUNDS - MIN_DEMO_ROUNDS + 1 }, (_, i) => MIN_DEMO_ROUNDS + i);

const screenSettingsService = container.resolve(ScreenSettingsService);
const draft = useMediaDraft();
const saving = ref(false);
const saveStatus = ref('');

const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

/** サーバーの値(読み込み・同期で更新)に、利用者が選んだ項目だけを重ねて持つ。入力欄は読み込み前から操作できる。 */
const fetchConfig = async (): Promise<DemoDrawSettings> =>
    parseDemoDrawSettings(await screenSettingsService.fetchScreenSetting('demo', 'demo-screen-settings'));
const form = useFormDraft<DemoDrawSettings>({ ...DEFAULT_DEMO_DRAW }, fetchConfig);
const localConfig = form.view;
const hasUnsavedChanges = form.dirty;
draft.track(() => [localConfig.value.bgm]);

// 他の端末の変更が取り込まれたら読み直す(古い値のフォームを、そのまま保存して上書きしないため)。
const reloadAfterSync = () => form.load();

onMounted(async () => {
    eventBus.on('syncPulled', reloadAfterSync);
    await Promise.all([form.load(), draft.reload()]);
});

onBeforeUnmount(() => {
    eventBus.off('syncPulled', reloadAfterSync);
});

onBeforeRouteLeave((_to, _from, next) => {
    if (hasUnsavedChanges.value) {
        showUnsavedDialog.value = true;
        pendingRoute.value = next;
    } else {
        next();
    }
});

const handleSaveClick = async () => {
    saving.value = true;
    saveStatus.value = '保存中...';
    try {
        await form.save(async (cfg) => {
            const payload: DemoDrawSettings = { enabled: cfg.enabled, rounds: cfg.rounds, bgm: cfg.bgm };
            await screenSettingsService.saveScreenSetting('demo', 'demo-screen-settings', payload, draft.filesFor([payload.bgm]));
        });
        await draft.reload();
        saveStatus.value = '保存しました';
    } catch (err) {
        console.error('Failed to save demo config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const handleDiscardChanges = () => {
    showUnsavedDialog.value = false;
    form.discard();
    if (pendingRoute.value) {
        pendingRoute.value();
    }
};

const handleCancelDiscard = () => {
    showUnsavedDialog.value = false;
    pendingRoute.value = null;
};
</script>

<style scoped>
.status-text {
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
}

.section-hint {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
    margin: 0 0 12px;
}

.admin-section {
    margin-bottom: 32px;
}

.tab-content {
    padding: 8px 0;
}

.screen-config {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    column-gap: 24px;
    margin-bottom: 12px;
}

.config-item {
    margin-bottom: 24px;
    min-width: 0;
}

.check-row,
.field-label {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
    font-weight: bold;
    color: var(--ui-text, #fff);
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    font-size: var(--ui-font-md, 1rem);
    width: 100%;
    box-sizing: border-box;
    max-width: 100%;
}
</style>
