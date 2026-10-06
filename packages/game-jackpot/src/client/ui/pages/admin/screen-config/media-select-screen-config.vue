<template>
    <div class="admin-section">
        <h2>{{ title }}</h2>
        <div class="tab-content">
            <div class="screen-config">
                <div v-for="field in fields" :key="field.key" class="config-item">
                    <label>{{ field.label }}:</label>
                    <select v-model="localConfig[field.key]" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
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
import { ref, onMounted, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { AssetDataService } from '@control/asset/asset-data-service';
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
const assetService = container.resolve(AssetDataService);

const audioAssets = ref<any[]>([]);
const saving = ref(false);
const saveStatus = ref('');

const hasUnsavedChanges = ref(false);
const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const buildEmptyConfig = () => {
    const empty: Record<string, string> = {};
    for (const field of props.fields) empty[field.key] = '';
    return empty;
};

const localConfig = ref<Record<string, string>>(buildEmptyConfig());

const fetchAssets = async () => {
    try {
        const raw = await assetService.getAllAssetData();
        audioAssets.value = raw.filter((a: any) => a?.blob?.type?.startsWith('audio/'));
    } catch (error) {
        console.error('Failed to fetch assets:', error);
        audioAssets.value = [];
    }
};

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting(props.screenName, props.settingName);
        if (cfg) {
            for (const field of props.fields) {
                localConfig.value[field.key] = (cfg as any)[field.key] || '';
            }
        }
    } catch (error) {
        console.error(`Failed to load ${props.screenName} config:`, error);
    }
};

onMounted(async () => {
    await Promise.all([loadConfig(), fetchAssets()]);
    hasUnsavedChanges.value = false;
});

watch(localConfig, () => {
    hasUnsavedChanges.value = true;
}, { deep: true });

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
        const payload: Record<string, string> = {};
        for (const field of props.fields) payload[field.key] = localConfig.value[field.key];
        await screenSettingsService.saveScreenSetting(props.screenName, props.settingName, payload);
        await loadConfig();
        saveStatus.value = '保存しました';
        hasUnsavedChanges.value = false;
    } catch (err) {
        console.error(`Failed to save ${props.screenName} config`, err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const handleDiscardChanges = () => {
    showUnsavedDialog.value = false;
    hasUnsavedChanges.value = false;
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
