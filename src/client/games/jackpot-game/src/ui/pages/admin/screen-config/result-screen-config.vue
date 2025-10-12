<template>
    <div class="admin-section">
        <h2>最終結果画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>最終結果画面設定</h3>
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
                    <label>結果リストスクロールSE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.scrollSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.scrollSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.scrollSeMode === 'select'" v-model="localConfig.scrollSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.scrollSeMode === 'upload'" type="file" @change="onScrollSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>最高ランク景品当選者表示SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.highSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.highSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.highSeMode === 'select'" v-model="localConfig.highSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.highSeMode === 'upload'" type="file" @change="onHighSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>最低ランク景品当選者表示SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.lowSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.lowSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.lowSeMode === 'select'" v-model="localConfig.lowSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.lowSeMode === 'upload'" type="file" @change="onLowSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>黒画面フェードインSE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.fadeSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.fadeSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.fadeSeMode === 'select'" v-model="localConfig.fadeSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.fadeSeMode === 'upload'" type="file" @change="onFadeSeChange"
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
    bgmMode: 'select',
    bgmAssetId: '',
    scrollSeMode: 'select',
    scrollSeAssetId: '',
    highSeMode: 'select',
    highSeAssetId: '',
    lowSeMode: 'select',
    lowSeAssetId: '',
    fadeSeMode: 'select',
    fadeSeAssetId: '',
});

const loadConfig = async () => {
    try {
        const config = await screenConfigRepo.getScreenConfigById("result");
        if (config) {
            localConfig.value = {
                id: config.id || "",
                bgmMode: config.bgmAssetId ? "select" : "select",
                bgmAssetId: config.bgmAssetId || "",
                scrollSeMode: "select",
                scrollSeAssetId: config.seAssetIds?.[0] || "",
                highSeMode: "select",
                highSeAssetId: config.seAssetIds?.[1] || "",
                lowSeMode: "select",
                lowSeAssetId: config.seAssetIds?.[2] || "",
                fadeSeMode: "select",
                fadeSeAssetId: config.seAssetIds?.[3] || "",
            };
        }
    } catch (error) {
        console.error("Failed to load result config:", error);
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

const onScrollSeChange = async (e: Event) => {
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
            localConfig.value.scrollSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onHighSeChange = async (e: Event) => {
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
            localConfig.value.highSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onLowSeChange = async (e: Event) => {
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
            localConfig.value.lowSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onFadeSeChange = async (e: Event) => {
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
            localConfig.value.fadeSeAssetId = "";
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
            type: "result" as const,
            bgmAssetId: localConfig.value.bgmAssetId || undefined,
            seAssetIds: [
                localConfig.value.scrollSeAssetId,
                localConfig.value.highSeAssetId,
                localConfig.value.lowSeAssetId,
                localConfig.value.fadeSeAssetId,
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