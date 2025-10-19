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
                    <input v-if="localConfig.homeBgmMode === 'upload'" type="file" @change="(e) => onHomeBgmChange(e)"
                        accept="audio/*" class="admin-input" />
                    <div v-if="localConfig.homeBgmMode === 'upload' && localConfig.homeBgmFilename" class="file-name">{{
                        localConfig.homeBgmFilename }}</div>
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
                    <input v-if="localConfig.buttonClikingSEMode === 'upload'" type="file"
                        @change="onButtonClikingSEChange" accept="audio/*" class="admin-input" />
                    <div v-if="localConfig.buttonClikingSEMode === 'upload' && localConfig.buttonClikingSEFilename"
                        class="file-name">{{ localConfig.buttonClikingSEFilename }}</div>
                    <select v-if="localConfig.buttonClikingSEMode === 'select'" v-model="localConfig.buttonClikingSE"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>読み込み完了SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.onCompletedLoadingSEMode" value="upload" />
                            アップロード</label>
                        <label><input type="radio" v-model="localConfig.onCompletedLoadingSEMode" value="select" />
                            既存から選択</label>
                    </div>
                    <input v-if="localConfig.onCompletedLoadingSEMode === 'upload'" type="file"
                        @change="onOnCompletedLoadingSEChange" accept="audio/*" class="admin-input" />
                    <div v-if="localConfig.onCompletedLoadingSEMode === 'upload' && localConfig.onCompletedLoadingSEFilename"
                        class="file-name">{{ localConfig.onCompletedLoadingSEFilename }}</div>
                    <select v-if="localConfig.onCompletedLoadingSEMode === 'select'"
                        v-model="localConfig.onCompletedLoadingSE" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
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
                <button class="admin-btn mt-4" @click="handleSyncClick" :disabled="syncing"
                    :style="{ opacity: syncing ? 0.6 : 1 }">同期</button>
                <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
            </div>
            <!-- ロードモーダル -->
            <div v-if="loading" class="modal-overlay">
                <div class="modal-content">
                    <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
                    <p>アセットを読み込んでいます。しばらくお待ちください。</p>
                    <div class="spinner"></div>
                </div>
            </div>
            <!-- 保存モーダル -->
            <div v-if="saving" class="modal-overlay">
                <div class="modal-content">
                    <h3>保存中...</h3>
                    <p>{{ saveStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>
            <!-- アップロードモーダル -->
            <div v-if="uploading" class="modal-overlay">
                <div class="modal-content">
                    <h3>アセットをアップロード中...</h3>
                    <p>ファイルをアップロードしています。しばらくお待ちください。</p>
                    <div class="spinner"></div>
                </div>
            </div>
            <!-- 同期モーダル -->
            <div v-if="syncing" class="modal-overlay">
                <div class="modal-content">
                    <h3>同期中...</h3>
                    <p>{{ syncStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useScreenSettingData } from './use-screen-setting-data';
import { HomeScreenSetting } from '../../../../model/domains/screen-config/home-screen-setting';
import { HomeScreenConfigConverter } from '../../../../model/applications/screen-config/home/home-screen-config-converter';
import { container } from 'tsyringe';
import type { Asset } from "../../../../model/domains/drive-data/asset-data";

const {
    screenConfigService,
    audioAssets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    uploading,
    handleSave,
    onTempAssets,
    assetService,
    fetchAssets,
} = useScreenSettingData();

const syncing = ref(false);
const syncStatus = ref("");

const localConfig = ref({
    homeBgm: "",
    homeBgmMode: "select",
    homeBgmFilename: "",
    homeBgmTempAsset: null as Asset | null,
    buttonClikingSE: "",
    buttonClikingSEMode: "select",
    buttonClikingSEFilename: "",
    buttonClikingSETempAsset: null as Asset | null,
    onCompletedLoadingSE: "",
    onCompletedLoadingSEMode: "select",
    onCompletedLoadingSEFilename: "",
    onCompletedLoadingSETempAsset: null as Asset | null,
    title: "",
    subtitle: "",
});

const loadConfig = async () => {
    try {
        const config = await screenConfigService.fetchScreenConfig("home");
        if (config) {
            localConfig.value.homeBgm = (config as any).homeBgm || "";
            localConfig.value.homeBgmMode = "select";
            localConfig.value.homeBgmFilename = "";
            localConfig.value.homeBgmTempAsset = null;
            localConfig.value.buttonClikingSE = (config as any).buttonClikingSE || "";
            localConfig.value.buttonClikingSEMode = "select";
            localConfig.value.buttonClikingSEFilename = "";
            localConfig.value.buttonClikingSETempAsset = null;
            localConfig.value.onCompletedLoadingSE = (config as any).onCompletedLoadingSE || "";
            localConfig.value.onCompletedLoadingSEMode = "select";
            localConfig.value.onCompletedLoadingSEFilename = "";
            localConfig.value.onCompletedLoadingSETempAsset = null;
            localConfig.value.title = (config as any).title || "2025年度 ジャックポッド大会！";
            localConfig.value.subtitle = (config as any).subtitle || "";
        }
    } catch (error) {
        console.error("Failed to load home config:", error);
    }
};

const onHomeBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        localConfig.value.homeBgmTempAsset = dto;
        localConfig.value.homeBgmFilename = file.name;
        onTempAssets([dto]);
    }
};

const onButtonClikingSEChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        localConfig.value.buttonClikingSETempAsset = dto;
        localConfig.value.buttonClikingSEFilename = file.name;
        onTempAssets([dto]);
    }
};

const onOnCompletedLoadingSEChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        localConfig.value.onCompletedLoadingSETempAsset = dto;
        localConfig.value.onCompletedLoadingSEFilename = file.name;
        onTempAssets([dto]);
    }
};

const handleSaveClick = async () => {
    await handleSave(async () => {
        // Collect temp assets
        const tempAssetsToAdd: Asset[] = [];
        if (localConfig.value.homeBgmTempAsset) tempAssetsToAdd.push(localConfig.value.homeBgmTempAsset);
        if (localConfig.value.buttonClikingSETempAsset) tempAssetsToAdd.push(localConfig.value.buttonClikingSETempAsset);
        if (localConfig.value.onCompletedLoadingSETempAsset) tempAssetsToAdd.push(localConfig.value.onCompletedLoadingSETempAsset);

        // Upload temp assets and get IDs
        let homeBgmId = localConfig.value.homeBgm;
        let buttonClikingSEId = localConfig.value.buttonClikingSE;
        let onCompletedLoadingSEId = localConfig.value.onCompletedLoadingSE;

        if (tempAssetsToAdd.length > 0) {
            const updatedAssets = await assetService.addDriveData(tempAssetsToAdd);
            // Update temp assets with new IDs
            localConfig.value.homeBgmTempAsset = updatedAssets.find(a => a.name === localConfig.value.homeBgmTempAsset?.name) || localConfig.value.homeBgmTempAsset;
            localConfig.value.buttonClikingSETempAsset = updatedAssets.find(a => a.name === localConfig.value.buttonClikingSETempAsset?.name) || localConfig.value.buttonClikingSETempAsset;
            localConfig.value.onCompletedLoadingSETempAsset = updatedAssets.find(a => a.name === localConfig.value.onCompletedLoadingSETempAsset?.name) || localConfig.value.onCompletedLoadingSETempAsset;
            homeBgmId = localConfig.value.homeBgmTempAsset?.id || localConfig.value.homeBgm;
            buttonClikingSEId = localConfig.value.buttonClikingSETempAsset?.id || localConfig.value.buttonClikingSE;
            onCompletedLoadingSEId = localConfig.value.onCompletedLoadingSETempAsset?.id || localConfig.value.onCompletedLoadingSE;
        }

        const config = new HomeScreenSetting(
            homeBgmId,
            buttonClikingSEId,
            onCompletedLoadingSEId,
            localConfig.value.title,
            localConfig.value.subtitle
        );
        const converter = container.resolve(HomeScreenConfigConverter);
        const settings = converter.toSettings(config);
        await screenConfigService.saveScreenConfigs(settings);
        await loadConfig();
        await fetchAssets();

        // Register references for newly uploaded assets
        if (tempAssetsToAdd.length > 0) {
        }
    });
};

onMounted(async () => {
    await loadConfig();
});

const handleSyncClick = async () => {
    syncing.value = true;
    syncStatus.value = "サーバーと同期中...";
    try {
        await screenConfigService.syncScreenConfigs();
        await loadConfig();
        syncStatus.value = "同期完了";
    } catch (error) {
        console.error("Failed to sync screen configs:", error);
        syncStatus.value = "同期に失敗しました";
    } finally {
        syncing.value = false;
    }
};
</script>

<style scoped>
.admin-section {
    margin-bottom: 32px;
}

.tab-content {
    padding: 24px;
    background: #232b36;
    border-radius: 8px;
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

/* Prevent inputs and flex children from causing horizontal overflow */
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