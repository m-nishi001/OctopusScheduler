<template>
    <div class="admin-section">
        <h2>エンディング画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>エンディング画面設定</h3>
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
                    <label>コンテンツ:</label>
                    <div v-for="(content, idx) in localConfig.contents" :key="idx" class="content-item">
                        <select v-model="content.type" class="admin-input">
                            <option value="text">テキスト</option>
                            <option value="image">画像</option>
                            <option value="html">HTML</option>
                        </select>
                        <input v-if="content.type === 'text'" v-model="content.text" placeholder="テキスト内容"
                            class="admin-input" />
                        <textarea v-if="content.type === 'html'" v-model="content.content" placeholder="HTMLを入力"
                            class="admin-input" rows="6"></textarea>
                        <div v-if="content.type === 'image'">
                            <div class="asset-mode">
                                <label><input type="radio" v-model="content.imageMode" value="select" /> 既存から選択</label>
                                <label><input type="radio" v-model="content.imageMode" value="upload" /> アップロード</label>
                            </div>
                            <select v-if="content.imageMode === 'select'" v-model="content.assetId" class="admin-input">
                                <option value="">選択なし</option>
                                <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
                                </option>
                            </select>
                            <input v-if="content.imageMode === 'upload'" type="file"
                                @change="(e) => onImageChange(e, idx)" accept="image/*" class="admin-input" />
                        </div>
                        <select v-model="content.effect" class="admin-input">
                            <option value="scroll">スクロール</option>
                            <option value="fade">フェード</option>
                            <option value="static">静止</option>
                        </select>
                        <input v-model.number="content.duration" type="number" placeholder="表示時間(ms)"
                            class="admin-input" />
                        <div class="asset-mode">
                            <label><input type="radio" v-model="content.seMode" value="select" /> SE選択</label>
                            <label><input type="radio" v-model="content.seMode" value="upload" /> SEアップロード</label>
                        </div>
                        <select v-if="content.seMode === 'select'" v-model="content.seAssetId" class="admin-input">
                            <option value="">選択なし</option>
                            <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
                            </option>
                        </select>
                        <input v-if="content.seMode === 'upload'" type="file" @change="(e) => onSeChange(e, idx)"
                            accept="audio/*" class="admin-input" />
                        <button class="admin-btn" @click="removeContent(idx)">削除</button>
                    </div>
                    <button class="admin-btn" @click="addContent">コンテンツ追加</button>
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
    imageAssets,
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
    contents: [] as any[],
});

const loadConfig = async () => {
    try {
        const config = await screenConfigRepo.getScreenConfigById("ending");
        if (config) {
            localConfig.value = {
                id: config.id || "",
                bgmMode: config.bgmAssetId ? "select" : "select",
                bgmAssetId: config.bgmAssetId || "",
                contents: config.elements?.map((el: any) => ({
                    type: el.type || 'text',
                    text: el.content || '',
                    content: el.content || '',
                    assetId: el.assetId || '',
                    imageMode: el.assetId ? 'select' : 'upload',
                    seMode: 'select',
                    effect: el.animation?.type || 'fade',
                    duration: el.animation?.duration || 3000,
                    seAssetId: '',
                })) || [],
            };
        }
    } catch (error) {
        console.error("Failed to load ending config:", error);
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

const onImageChange = async (e: Event, idx: number) => {
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
            localConfig.value.contents[idx].assetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onSeChange = async (e: Event, idx: number) => {
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
            localConfig.value.contents[idx].seAssetId = "";
            onTempAssets(tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
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
    });
};

const removeContent = (idx: number) => {
    localConfig.value.contents.splice(idx, 1);
};

const handleSaveClick = async () => {
    await handleSave(async () => {
        const configObj = {
            id: localConfig.value.id,
            type: "ending" as const,
            bgmAssetId: localConfig.value.bgmAssetId || undefined,
            seAssetIds: localConfig.value.contents.flatMap((c: any) =>
                c.seAssetId ? [c.seAssetId] : []
            ),
            backgroundStyle: "",
            displayMode: "list",
            elements: localConfig.value.contents.map((content: any) => ({
                type: content.type as any,
                content:
                    content.type === "html"
                        ? content.content || content.text
                        : content.text,
                assetId: content.assetId,
                animation: {
                    type: content.effect as any,
                    duration: content.duration,
                    scrollDirection: content.scrollDirection,
                },
            })),
        };
        await screenConfigRepo.updateScreenConfigs([configObj] as any);
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