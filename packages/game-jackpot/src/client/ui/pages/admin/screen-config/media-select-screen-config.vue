<template>
    <div class="admin-section">
        <h2>{{ title }}</h2>
        <div class="tab-content">
            <div class="screen-config">
                <div v-for="field in fields" :key="field.key" class="config-item">
                    <MediaPicker :label="field.label" kind="audio" 
                        :model-value="localConfig[field.key]" @update:model-value="form.set(field.key, $event)"
                        :options="draft.optionsOf('audio')" :preview-url="draft.urlOf(localConfig[field.key])"
                        @pick="draft.pick" />
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
import UnsavedChangesDialog from './unsaved-changes-dialog.vue';

/**
 * demo/result画面設定が持っていた「BGM + N個のSEをプルダウンで選ぶだけ」の
 * 共通パターンを1つに集約したもの。fieldsで画面ごとのフィールド一覧
 * (キー名とラベル)を渡す。
 */
const props = defineProps<{
    screenName: string;
    settingName: string;
    title: string;
    fields: { key: string; label: string }[];
}>();

const screenSettingsService = container.resolve(ScreenSettingsService);
const draft = useMediaDraft();
const saving = ref(false);
const saveStatus = ref('');

const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const buildEmptyConfig = () => {
    const empty: Record<string, string> = {};
    for (const field of props.fields) empty[field.key] = '';
    return empty;
};

/** サーバーの値(読み込み・同期で更新)に、利用者が選んだ項目だけを重ねて持つ。選択欄は読み込み前から操作できる。 */
const fetchConfig = async (): Promise<Record<string, string>> => {
    const cfg = await screenSettingsService.fetchScreenSetting(props.screenName, props.settingName);
    const loaded = buildEmptyConfig();
    if (cfg) {
        for (const field of props.fields) loaded[field.key] = (cfg as any)[field.key] || '';
    }
    return loaded;
};
const form = useFormDraft<Record<string, string>>(buildEmptyConfig(), fetchConfig);
const localConfig = form.view;
const hasUnsavedChanges = form.dirty;
draft.track(() => Object.values(localConfig.value));

// 他の端末の変更が取り込まれたら読み直す(古い値のフォームを、そのまま保存して上書きしないため)。
// 読み込みは「サーバーの値」だけを更新し、選択の途中の項目には触れない
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
            const payload: Record<string, string> = {};
            for (const field of props.fields) payload[field.key] = cfg[field.key];
            await screenSettingsService.saveScreenSetting(props.screenName, props.settingName, payload, draft.filesFor(Object.values(payload)));
        });
        await draft.reload();
        saveStatus.value = '保存しました';
    } catch (err) {
        console.error(`Failed to save ${props.screenName} config`, err);
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

.admin-section {
    margin-bottom: 32px;
}

.tab-content {
    padding: 8px 0;
    background: transparent;
    border-radius: 0;
}

.screen-config {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    column-gap: 24px;
    margin-bottom: 12px;
}

.screen-config h3 {
    margin-bottom: 16px;
    color: var(--ui-text, #fff);
}

.config-item {
    margin-bottom: 24px;
    min-width: 0;
}

.config-item label {
    display: block;
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
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    margin-bottom: 8px;
    width: 100%;
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}
</style>
