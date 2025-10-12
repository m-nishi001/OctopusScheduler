<template>
    <div class="admin-section">
        <h2>本抽選画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>本抽選画面設定</h3>
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
                    <label>メンバー選出SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.memberSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.memberSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.memberSeMode === 'select'" v-model="localConfig.memberSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.memberSeMode === 'upload'" type="file" @change="onMemberSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>景品抽選開始SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.prizeStartSeMode" value="select" />
                            既存から選択</label>
                        <label><input type="radio" v-model="localConfig.prizeStartSeMode" value="upload" />
                            アップロード</label>
                    </div>
                    <select v-if="localConfig.prizeStartSeMode === 'select'" v-model="localConfig.prizeStartSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.prizeStartSeMode === 'upload'" type="file" @change="onPrizeStartSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>抽選演出SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.lotterySeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.lotterySeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.lotterySeMode === 'select'" v-model="localConfig.lotterySeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.lotterySeMode === 'upload'" type="file" @change="onLotterySeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>抽選確定SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.confirmSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.confirmSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.confirmSeMode === 'select'" v-model="localConfig.confirmSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.confirmSeMode === 'upload'" type="file" @change="onConfirmSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>当選景品表示SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.winnerSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.winnerSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.winnerSeMode === 'select'" v-model="localConfig.winnerSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.winnerSeMode === 'upload'" type="file" @change="onWinnerSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>「次の人を抽選します！」SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.nextSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.nextSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.nextSeMode === 'select'" v-model="localConfig.nextSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.nextSeMode === 'upload'" type="file" @change="onNextSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>「残り半分です！」SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.halfSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.halfSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.halfSeMode === 'select'" v-model="localConfig.halfSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.halfSeMode === 'upload'" type="file" @change="onHalfSeChange"
                        accept="audio/*" class="admin-input" />
                </div>
                <div class="config-item">
                    <label>抽選終了SE:</label>
                    <div class="asset-mode">
                        <label><input type="radio" v-model="localConfig.endSeMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="localConfig.endSeMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="localConfig.endSeMode === 'select'" v-model="localConfig.endSeAssetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="localConfig.endSeMode === 'upload'" type="file" @change="onEndSeChange"
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
    memberSeMode: 'select',
    memberSeAssetId: '',
    prizeStartSeMode: 'select',
    prizeStartSeAssetId: '',
    lotterySeMode: 'select',
    lotterySeAssetId: '',
    confirmSeMode: 'select',
    confirmSeAssetId: '',
    winnerSeMode: 'select',
    winnerSeAssetId: '',
    nextSeMode: 'select',
    nextSeAssetId: '',
    halfSeMode: 'select',
    halfSeAssetId: '',
    endSeMode: 'select',
    endSeAssetId: '',
});

const loadConfig = async () => {
    try {
        const config = await screenConfigRepo.getScreenConfigById("main");
        if (config) {
            localConfig.value = {
                id: config.id || "",
                bgmMode: config.bgmAssetId ? "select" : "select",
                bgmAssetId: config.bgmAssetId || "",
                memberSeMode: "select",
                memberSeAssetId: config.seAssetIds?.[0] || "",
                prizeStartSeMode: "select",
                prizeStartSeAssetId: config.seAssetIds?.[1] || "",
                lotterySeMode: "select",
                lotterySeAssetId: config.seAssetIds?.[2] || "",
                confirmSeMode: "select",
                confirmSeAssetId: config.seAssetIds?.[3] || "",
                winnerSeMode: "select",
                winnerSeAssetId: config.seAssetIds?.[4] || "",
                nextSeMode: "select",
                nextSeAssetId: config.seAssetIds?.[5] || "",
                halfSeMode: "select",
                halfSeAssetId: config.seAssetIds?.[6] || "",
                endSeMode: "select",
                endSeAssetId: config.seAssetIds?.[7] || "",
            };
        }
    } catch (error) {
        console.error("Failed to load main config:", error);
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

const onMemberSeChange = async (e: Event) => {
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
            localConfig.value.memberSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onPrizeStartSeChange = async (e: Event) => {
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
            localConfig.value.prizeStartSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onLotterySeChange = async (e: Event) => {
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
            localConfig.value.lotterySeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onConfirmSeChange = async (e: Event) => {
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
            localConfig.value.confirmSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onWinnerSeChange = async (e: Event) => {
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
            localConfig.value.winnerSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onNextSeChange = async (e: Event) => {
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
            localConfig.value.nextSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onHalfSeChange = async (e: Event) => {
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
            localConfig.value.halfSeAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onEndSeChange = async (e: Event) => {
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
            localConfig.value.endSeAssetId = "";
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
            type: "main" as const,
            bgmAssetId: localConfig.value.bgmAssetId || undefined,
            seAssetIds: [
                localConfig.value.memberSeAssetId,
                localConfig.value.prizeStartSeAssetId,
                localConfig.value.lotterySeAssetId,
                localConfig.value.confirmSeAssetId,
                localConfig.value.winnerSeAssetId,
                localConfig.value.nextSeAssetId,
                localConfig.value.halfSeAssetId,
                localConfig.value.endSeAssetId,
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