<template>
    <div class="admin-section">
        <h2>デモ抽選画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>デモ抽選画面設定</h3>
                <div class="config-item">
                    <label>当選者:</label>
                    <select v-model="localConfig.winnerMemberId" class="admin-input">
                        <option value="">選択</option>
                        <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>当選景品:</label>
                    <select v-model="localConfig.winnerPrizeId" class="admin-input">
                        <option value="">選択</option>
                        <option v-for="prize in prizes" :key="prize.id" :value="prize.id">{{ prize.name }}</option>
                    </select>
                </div>
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
                    <label>SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.seMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.seMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.seMode === 'select'" v-model="localConfig.seAssetId" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.seMode === 'upload'" type="file" @change="onSeChange" accept="audio/*"
                        class="admin-input" />
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
                    <p>アセット、メンバー、景品を読み込んでいます。しばらくお待ちください。</p>
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
    members,
    prizes,
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
    winnerMemberId: "",
    winnerPrizeId: "",
    bgmMode: "select",
    bgmAssetId: "",
    seMode: "select",
    seAssetId: "",
});

const loadConfig = async () => {
    try {
        const config = await screenConfigRepo.getScreenConfigById("demo");
        if (config) {
            localConfig.value = {
                id: config.id || "",
                winnerMemberId: "",
                winnerPrizeId: "",
                bgmMode: config.bgmAssetId ? "select" : "select",
                bgmAssetId: config.bgmAssetId || "",
                seMode: "select",
                seAssetId: config.seAssetIds?.[0] || "",
            };
        }
    } catch (error) {
        console.error("Failed to load demo config:", error);
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

const onSeChange = async (e: Event) => {
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
            localConfig.value.seAssetId = "";
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
            type: "demo" as const,
            bgmAssetId: localConfig.value.bgmAssetId || undefined,
            seAssetIds: localConfig.value.seAssetId ? [localConfig.value.seAssetId] : [],
            backgroundStyle: "",
            elements: [{
                winnerMemberId: localConfig.value.winnerMemberId,
                winnerPrizeId: localConfig.value.winnerPrizeId,
            }],
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