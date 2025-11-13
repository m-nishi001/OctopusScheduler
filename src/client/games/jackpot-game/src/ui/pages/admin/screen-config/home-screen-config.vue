<template>
    <div class="admin-section">
        <h2>ホーム画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>ホーム画面設定</h3>
                <div class="config-item">
                    <label>ホームBGM:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.homeBgmMode" value="upload" /> アップロード</label>
                        <label><input type="radio" v-model="localConfig.homeBgmMode" value="select" /> 既存から選択</label>
                    </div>
                    <input v-if="localConfig.homeBgmMode === 'upload'" ref="homeBgmInputRef" type="file"
                        @change="(e) => onHomeBgmChange(e)" accept="audio/*" class="admin-input" />
                    <div v-if="localConfig.homeBgmMode === 'upload' && localConfig.homeBgmFilename" class="file-name">{{
                        localConfig.homeBgmFilename }}</div>
                    <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
                        <button class="admin-btn" @click.prevent="previewHomeBgm" :disabled="previewing">プレビュー</button>
                        <button class="admin-btn" @click.prevent="stopPreview" :disabled="!previewing">停止</button>
                        <div style="color:#fff;font-size:0.9rem;">{{ previewStatus }}</div>
                    </div>
                    <select v-if="localConfig.homeBgmMode === 'select'" v-model="localConfig.homeBgm"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>ボタンクリックSE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.buttonClikingSEMode" value="upload" />
                            アップロード</label>
                        <label><input type="radio" v-model="localConfig.buttonClikingSEMode" value="select" />
                            既存から選択</label>
                    </div>
                    <input v-if="localConfig.buttonClikingSEMode === 'upload'" ref="buttonSEInputRef" type="file"
                        @change="onButtonClikingSEChange" accept="audio/*" class="admin-input" />
                    <div v-if="localConfig.buttonClikingSEMode === 'upload' && localConfig.buttonClikingSEFilename"
                        class="file-name">{{ localConfig.buttonClikingSEFilename }}</div>
                    <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
                        <button class="admin-btn" @click.prevent="previewButtonSE" :disabled="previewing">プレビュー</button>
                        <button class="admin-btn" @click.prevent="stopPreview" :disabled="!previewing">停止</button>
                    </div>
                    <select v-if="localConfig.buttonClikingSEMode === 'select'" v-model="localConfig.buttonClikingSE"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                </div>
                <div class="config-item">
                    <label>タイトル文言:</label>
                    <input type="text" v-model="localConfig.title" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>サブタイトル文言:</label>
                    <input type="text" v-model="localConfig.subtitle" class="admin-input" />
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving || uploading"
                    :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
                <button class="admin-btn mt-4" @click="handleClearClick" :disabled="saving || uploading || syncing"
                    :style="{ opacity: (saving || uploading || syncing) ? 0.6 : 1 }">クリア</button>
                <button class="admin-btn mt-4" @click="handleSyncClick" :disabled="syncing"
                    :style="{ opacity: syncing ? 0.6 : 1 }">同期</button>
                <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
            </div>

            <div v-if="loading" class="modal-overlay">
                <div class="modal-content">
                    <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
                    <p>アセットを読み込んでいます。しばらくお待ちください。</p>
                    <div class="spinner"></div>
                </div>
            </div>

            <div v-if="saving" class="modal-overlay">
                <div class="modal-content">
                    <h3>保存中...</h3>
                    <p>{{ saveStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>

            <div v-if="uploading" class="modal-overlay">
                <div class="modal-content">
                    <h3>アセットをアップロード中...</h3>
                    <p>ファイルをアップロードしています。しばらくお待ちください。</p>
                    <div class="spinner"></div>
                </div>
            </div>

            <div v-if="syncing" class="modal-overlay">
                <div class="modal-content">
                    <h3>同期中...</h3>
                    <p>{{ syncStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>

            <UnsavedChangesDialog :visible="showUnsavedDialog" @discard="handleDiscardChanges"
                @cancel="handleCancelDiscard" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import type { Asset } from "@model/domains/drive-data/asset-data";
import UnsavedChangesDialog from './unsaved-changes-dialog.vue';

const screenSettingsService = container.resolve(ScreenSettingsService);
const assetService = container.resolve(AssetDataService);

const audioAssets = ref<any[]>([]);
const loading = ref(false);
const loadingStatus = ref('');
const saving = ref(false);
const saveStatus = ref('');
const uploading = ref(false);

const homeBgmInputRef = ref<HTMLInputElement | null>(null);
const buttonSEInputRef = ref<HTMLInputElement | null>(null);

const fetchAssets = async () => {
    try {

        const all = await assetService.getAllAssetData();
        audioAssets.value = all.filter((a: any) => !!a?.type && a.type.startsWith('audio/'));
    } catch (e) {
        audioAssets.value = [];
    }
};

const tempAssets: Asset[] = [];

const syncing = ref(false);
const syncStatus = ref("");

const hasUnsavedChanges = ref(false);
const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const localConfig = ref({
    homeBgm: "",
    homeBgmMode: "select",
    homeBgmFilename: "",
    homeBgmTempAsset: null as Asset | null,
    buttonClikingSE: "",
    buttonClikingSEMode: "select",
    buttonClikingSEFilename: "",
    buttonClikingSETempAsset: null as Asset | null,

    title: "",
    subtitle: "",
});

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting('home', 'home-screen-settings');
        if (cfg) {
            localConfig.value.homeBgm = (cfg as any).homeBgm || "";
            localConfig.value.homeBgmMode = "select";
            localConfig.value.homeBgmFilename = "";
            localConfig.value.homeBgmTempAsset = null;
            localConfig.value.buttonClikingSE = (cfg as any).buttonClikingSE || "";
            localConfig.value.buttonClikingSEMode = "select";
            localConfig.value.buttonClikingSEFilename = "";
            localConfig.value.buttonClikingSETempAsset = null;

            localConfig.value.title = (cfg as any).title || "2025年度 ジャックポッド大会！";
            localConfig.value.subtitle = (cfg as any).subtitle || "";
        }
    } catch (error) {
        console.error("Failed to load home config:", error);
    }
};

const previewAudio = ref<HTMLAudioElement | null>(null);
let previewObjectUrl: string | undefined;
const previewing = ref(false);
const previewStatus = ref('');

const stopPreview = () => {
    if (previewAudio.value) {
        try { previewAudio.value.pause(); } catch (e) { }
        previewAudio.value = null;
    }
    if (previewObjectUrl) {
        try { URL.revokeObjectURL(previewObjectUrl); } catch (e) { }
        previewObjectUrl = undefined;
    }
    previewing.value = false;
    previewStatus.value = '';
};

const playPreviewFromBlob = async (blob: Blob | null, loop = false, volume = 1) => {
    stopPreview();
    if (!blob) return;
    try {
        previewObjectUrl = URL.createObjectURL(blob);
        previewAudio.value = new Audio(previewObjectUrl);
        previewAudio.value.loop = loop;
        previewAudio.value.volume = volume;
        await previewAudio.value.play();
        previewing.value = true;
        previewStatus.value = '再生中';
        if (!loop) {
            previewAudio.value.addEventListener('ended', () => {
                stopPreview();
            }, { once: true });
        }
    } catch (e) {
        console.warn('Preview play failed', e);
        stopPreview();
    }
};

const playPreviewFromAssetId = async (assetId: string | undefined, loop = false, volume = 1) => {
    if (!assetId) return;
    try {
        const asset = await assetService.getAssetDataById(assetId);
        const blob = asset ? (asset as any).blob as Blob : null;
        await playPreviewFromBlob(blob, loop, volume);
    } catch (e) {
        console.error('Failed to fetch asset for preview', e);
    }
};

const previewHomeBgm = async () => {

    if (localConfig.value.homeBgmMode === 'upload' && localConfig.value.homeBgmTempAsset) {
        await playPreviewFromBlob((localConfig.value.homeBgmTempAsset as any).blob as Blob, true, 0.5);
        return;
    }
    if (localConfig.value.homeBgm) {
        await playPreviewFromAssetId(localConfig.value.homeBgm, true, 0.5);
    }
};

const previewButtonSE = async () => {
    if (localConfig.value.buttonClikingSEMode === 'upload' && localConfig.value.buttonClikingSETempAsset) {
        await playPreviewFromBlob((localConfig.value.buttonClikingSETempAsset as any).blob as Blob, false, 1);
        return;
    }
    if (localConfig.value.buttonClikingSE) {
        await playPreviewFromAssetId(localConfig.value.buttonClikingSE, false, 1);
    }
};


const onHomeBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);


        (dto as any).__field = 'homeBgm';
        localConfig.value.homeBgmTempAsset = dto;
        localConfig.value.homeBgmFilename = file.name;
        tempAssets.push(dto);
    }
};

const onButtonClikingSEChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        (dto as any).__field = 'buttonClikingSE';
        localConfig.value.buttonClikingSETempAsset = dto;
        localConfig.value.buttonClikingSEFilename = file.name;
        tempAssets.push(dto);
    }
};


const handleSaveClick = async () => {
    saving.value = true;
    saveStatus.value = '保存中...';
    try {




        const uploads = tempAssets.length > 0 ? await assetService.addAssetData(tempAssets) : [];

        if (uploads.length > 0) {

            for (let i = 0; i < uploads.length; i++) {
                const orig = tempAssets[i] as any;
                const saved = uploads[i];
                if (!orig || !saved) continue;
                const f = orig.__field;
                if (f === 'homeBgm') {
                    localConfig.value.homeBgm = saved.id;
                    localConfig.value.homeBgmMode = 'select';
                    localConfig.value.homeBgmFilename = '';
                    localConfig.value.homeBgmTempAsset = null;
                } else if (f === 'buttonClikingSE') {
                    localConfig.value.buttonClikingSE = saved.id;
                    localConfig.value.buttonClikingSEMode = 'select';
                    localConfig.value.buttonClikingSEFilename = '';
                    localConfig.value.buttonClikingSETempAsset = null;
                }
            }

            tempAssets.length = 0;
            if (homeBgmInputRef.value) homeBgmInputRef.value.value = '';
            if (buttonSEInputRef.value) buttonSEInputRef.value.value = '';
        }

        const payload = {
            homeBgm: localConfig.value.homeBgm || '',
            buttonClikingSE: localConfig.value.buttonClikingSE || '',
            title: localConfig.value.title,
            subtitle: localConfig.value.subtitle,
        };


        await screenSettingsService.saveScreenSetting(
            'home',
            'home-screen-settings',
            payload,
            uploads.length ? uploads : undefined
        );

        await loadConfig();
        await fetchAssets();
        saveStatus.value = '保存しました';
        hasUnsavedChanges.value = false;
    } catch (err) {
        console.error('Failed to save home config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const handleClearClick = async () => {

    localConfig.value.homeBgmMode = 'select';
    localConfig.value.buttonClikingSEMode = 'select';

    localConfig.value.homeBgm = '';
    localConfig.value.homeBgmFilename = '';
    localConfig.value.homeBgmTempAsset = null;

    localConfig.value.buttonClikingSE = '';
    localConfig.value.buttonClikingSEFilename = '';
    localConfig.value.buttonClikingSETempAsset = null;


    localConfig.value.title = '';
    localConfig.value.subtitle = '';

    tempAssets.length = 0;

    if (homeBgmInputRef.value) homeBgmInputRef.value.value = '';
    if (buttonSEInputRef.value) buttonSEInputRef.value.value = '';


    saveStatus.value = 'クリアしました';
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

onUnmounted(() => {
    stopPreview();
});

const handleSyncClick = async () => {
    syncing.value = true;
    syncStatus.value = "サーバーと同期中...";
    try {
        await screenSettingsService.syncToDrive();
        await loadConfig();
        syncStatus.value = "同期完了";
    } catch (error) {
        console.error("Failed to sync screen configs:", error);
        syncStatus.value = "同期に失敗しました";
    } finally {
        syncing.value = false;
    }
};

const handleDiscardChanges = () => {
    showUnsavedDialog.value = false;
    tempAssets.length = 0; // Clear uploaded assets
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
.admin-section {
    margin-bottom: 32px;
}

.tab-content {

    padding: 24px;
    background: transparent;
    border-radius: 0;
}

.screen-config {
    margin-bottom: 24px;
}

.screen-config h3 {
    margin-bottom: 16px;
    color: #fff;
}

.config-item {
    margin-bottom: 24px;
}

.config-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #fff;
}

.content-item,
.slide-item {
    border: 1px solid #555;
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 8px;
    background: #333;
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 1rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    margin-bottom: 8px;
    width: 100%;
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

.admin-btn {
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.admin-btn:hover {
    background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.asset-mode {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
}

.asset-mode label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
}

textarea.admin-input {
    resize: vertical;
    min-height: 100px;
}

.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #232b36;
    color: #fff;
    padding: 28px;
    border-radius: 10px;
    text-align: center;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
}

.spinner {
    margin: 16px auto;
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f8cff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}


.admin-input {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.asset-mode {
    flex-wrap: wrap;
}

.config-item {
    min-width: 0;
}
</style>