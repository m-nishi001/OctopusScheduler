<template>
    <div class="admin-section">
        <h2>ホーム画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>ホーム画面設定</h3>
                <div class="config-item">
                    <label>BGM:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.bgmMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.bgmMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.bgmMode === 'select'" v-model="localConfig.bgmAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.bgmMode === 'upload'" type="file" @change="onBgmChange" accept="audio/*"
                        class="admin-input" />
                </div>
                <div class="config-item">
                    <label>ボタン押下SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.buttonSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.buttonSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.buttonSeMode === 'select'" v-model="localConfig.buttonSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.buttonSeMode === 'upload'" type="file" @change="onButtonSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>プログレスバー完了SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.progressSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.progressSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.progressSeMode === 'select'" v-model="localConfig.progressSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.progressSeMode === 'upload'" type="file" @change="onProgressSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving || uploading"
                    :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
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
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { FileUtils } from '../../../../model/infrastructures/utils/file-utils';
import { AssetDto } from '../../../../model/applications/asset/dto/asset-dto';
import { useScreenSettingData } from './useScreenSettingData';

const {
    screenConfigRepo,
    audioAssets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    uploading,
    tempAssets,
    onTempAssets,
    handleSave,
} = useScreenSettingData();

const localConfig = ref({
    id: "",
    bgmMode: "select",
    bgmAssetId: "",
    buttonSeMode: "select",
    buttonSeAssetId: "",
    progressSeMode: "select",
    progressSeAssetId: "",
});

const loadConfig = async () => {
    try {
        const config = await screenConfigRepo.getScreenConfigById("home");
        if (config) {
            localConfig.value = {
                id: config.id || "",
                bgmMode: config.bgmAssetId ? "select" : "select",
                bgmAssetId: config.bgmAssetId || "",
                buttonSeMode: "select",
                buttonSeAssetId: config.seAssetIds?.[0] || "",
                progressSeMode: "select",
                progressSeAssetId: config.seAssetIds?.[1] || "",
            };
        }
    } catch (error) {
        console.error("Failed to load home config:", error);
    }
};

onMounted(async () => {
    await loadConfig();
});

const onBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            localConfig.value.bgmAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onButtonSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            localConfig.value.buttonSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onProgressSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            localConfig.value.progressSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const handleSaveClick = async () => {
    await handleSave(async () => {
        const config = {
            id: localConfig.value.id,
            type: "home" as const,
            bgmAssetId: localConfig.value.bgmAssetId || undefined,
            seAssetIds: [
                localConfig.value.buttonSeAssetId,
                localConfig.value.progressSeAssetId,
            ].filter((id: any) => id),
            backgroundStyle: "",
            elements: [],
        };
        await screenConfigRepo.updateScreenConfigs([config] as any);
        await loadConfig();
    });
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