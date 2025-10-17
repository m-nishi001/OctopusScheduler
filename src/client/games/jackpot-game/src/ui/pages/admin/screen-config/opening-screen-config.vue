<template>
    <div class="screen-config">
        <h3>オープニング画面設定</h3>
        <div class="config-item">
            <label>BGM:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="localConfig.bgmMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="localConfig.bgmMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="localConfig.bgmMode === 'select'" v-model="localConfig.bgmAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="localConfig.bgmMode === 'upload'" type="file" @change="onBgmChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>コンテンツ:</label>
            <div v-for="(content, idx) in localConfig.contents" :key="idx" class="content-item">
                <select v-model="content.type" class="admin-input">
                    <option value="text">テキスト</option>
                    <option value="image">画像</option>
                    <option value="html">HTML</option>
                </select>
                <input v-if="content.type === 'text'" v-model="content.text" placeholder="テキスト内容" class="admin-input" />
                <textarea v-if="content.type === 'html'" v-model="content.content" placeholder="HTMLを入力"
                    class="admin-input" rows="6"></textarea>
                <div v-if="content.type === 'image'">
                    <div class="asset-mode">
                        <label><input type="radio" v-model="content.imageMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="content.imageMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="content.imageMode === 'select'" v-model="content.assetId" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="content.imageMode === 'upload'" type="file" @change="(e) => onImageChange(e, idx)"
                        accept="image/*" class="admin-input" />
                </div>
                <select v-model="content.effect" class="admin-input">
                    <option value="scroll">スクロール</option>
                    <option value="fade">フェード</option>
                    <option value="static">静止</option>
                </select>
                <input v-model.number="content.duration" type="number" placeholder="表示時間(ms)" class="admin-input" />
                <div class="asset-mode">
                    <label><input type="radio" v-model="content.seMode" value="select" /> SE選択</label>
                    <label><input type="radio" v-model="content.seMode" value="upload" /> SEアップロード</label>
                </div>
                <select v-if="content.seMode === 'select'" v-model="content.seAssetId" class="admin-input">
                    <option value="">選択なし</option>
                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="content.seMode === 'upload'" type="file" @change="(e) => onSeChange(e, idx)"
                    accept="audio/*" class="admin-input" />
                <button class="admin-btn" @click="removeContent(idx)">削除</button>
            </div>
            <button class="admin-btn" @click="addContent">コンテンツ追加</button>
            <button class="admin-btn" @click="handleSaveClick" :disabled="saving"
                :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
            <button class="admin-btn" @click="handleSyncClick" :disabled="syncing"
                :style="{ opacity: syncing ? 0.6 : 1 }">同期</button>
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
    <!-- 同期モーダル -->
    <div v-if="syncing" class="modal-overlay">
        <div class="modal-content">
            <h3>同期中...</h3>
            <p>{{ syncStatus }}</p>
            <div class="spinner"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useScreenSettingData } from './use-screen-setting-data';
import { OpeningScreenSetting, type OpeningContent } from '../../../../model/domains/screen-config/opening-screen-setting';
import { OpeningScreenConfigConverter } from '../../../../model/applications/screen-config/opening/opening-screen-config-converter';
import { container } from 'tsyringe';

const {
    screenConfigService,
    audioAssets,
    imageAssets,
    assetService,
    onTempAssets,
    tempAssets,
    fetchAssets,
    saving,
    saveStatus,
    handleSave,
} = useScreenSettingData();

const syncing = ref(false);
const syncStatus = ref("");

const localConfig = ref({
    bgmAssetId: "",
    bgmMode: "select",
    contents: [] as OpeningContent[],
});

const loadConfig = async () => {
    try {
        const config = await screenConfigService.fetchScreenConfig("opening");
        if (config) {
            const openingConfig = config as OpeningScreenSetting;
            localConfig.value.bgmAssetId = openingConfig.bgmAssetId;
            localConfig.value.bgmMode = "select";
            localConfig.value.contents = openingConfig.contents;
        }
    } catch (error) {
        console.error("Failed to load opening config:", error);
    }
};

onMounted(async () => {
    await loadConfig();
});

const onBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const tempAsset = await assetService.createAssetDtoFromFile(file);
        onTempAssets([tempAsset]);
        localConfig.value.bgmAssetId = tempAsset.id;
    }
};

const onImageChange = async (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const tempAsset = await assetService.createAssetDtoFromFile(file);
        onTempAssets([tempAsset]);
        localConfig.value.contents[idx].assetId = tempAsset.id;
    }
};

const onSeChange = async (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const tempAsset = await assetService.createAssetDtoFromFile(file);
        onTempAssets([tempAsset]);
        localConfig.value.contents[idx].seAssetId = tempAsset.id;
    }
};

const addContent = () => {
    localConfig.value.contents.push({
        type: 'text',
        text: '',
        content: '',
        imageMode: 'select',
        assetId: '',
        effect: 'scroll',
        duration: 3000,
        seMode: 'select',
        seAssetId: '',
    } as OpeningContent);
};

const removeContent = (idx: number) => {
    localConfig.value.contents.splice(idx, 1);
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

const handleSaveClick = async () => {
    await handleSave(async () => {
        const oldTempAssets = [...tempAssets.value]; // 保存前のコピー
        const tempAssetMap = new Map<string, string>();
        let updatedAssets: any[] = [];

        // アップロード後に tempAssets が更新される
        if (tempAssets.value.length > 0) {
            updatedAssets = await assetService.addAssets(tempAssets.value);
            updatedAssets.forEach((asset: any, index: number) => {
                tempAssetMap.set(oldTempAssets[index].id, asset.id);
            });
        }

        // localConfig のアセットIDを置き換え
        if (tempAssetMap.has(localConfig.value.bgmAssetId)) {
            localConfig.value.bgmAssetId = tempAssetMap.get(localConfig.value.bgmAssetId)!;
        }
        localConfig.value.contents.forEach(content => {
            if (content.assetId && tempAssetMap.has(content.assetId)) {
                content.assetId = tempAssetMap.get(content.assetId)!;
            }
            if (content.seAssetId && tempAssetMap.has(content.seAssetId)) {
                content.seAssetId = tempAssetMap.get(content.seAssetId)!;
            }
        });

        const config = new OpeningScreenSetting();
        config.bgmAssetId = localConfig.value.bgmAssetId;
        config.contents = localConfig.value.contents;
        const converter = container.resolve(OpeningScreenConfigConverter);
        const settings = converter.toSettings(config);
        await screenConfigService.saveScreenConfigs(settings);

        await loadConfig();

        // Register references for newly uploaded assets
        if (tempAssets.value.length > 0) {
        }

        // tempAssets をクリア
        tempAssets.value = [];
        await fetchAssets();
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

.content-item {
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

/* Prevent inputs and flex children from causing horizontal overflow */
.admin-input {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.asset-mode {
    flex-wrap: wrap;
}

.content-item,
.config-item {
    min-width: 0;
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
</style>