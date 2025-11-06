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
            <div class="toolbar">
                <button class="admin-btn icon-only add-icon" @click="showAddDialog" title="追加">
                    <span class="emoji">➕</span>
                </button>
                <button class="admin-btn icon-only sync-icon" @click="handleSyncClick" :disabled="syncing"
                    title="同期">🔄</button>
                <button class="admin-btn icon-only delete-icon" @click="deleteSelectedContents"
                    :disabled="!selectedIndices.length" title="選択削除">🗑️</button>
            </div>

            <div class="select-all-row">
                <input type="checkbox" class="select-checkbox" v-model="isAllSelected" />
            </div>

            <div v-if="localConfig.contents.length === 0" class="empty-note">コンテンツがありません。追加してください。</div>

            <ul class="content-list">
                <li v-for="(content, idx) in localConfig.contents" :key="idx" class="content-list-item">
                    <div class="select-col">
                        <input type="checkbox" class="row-checkbox" :value="idx" v-model="selectedIndices" />
                    </div>
                    <div class="content-summary">
                        <span class="content-index">{{ idx + 1 }}.</span>
                        <span class="content-title">{{ getContentTitle(content) }}</span>
                    </div>
                    <div class="content-list-actions">
                        <button class="admin-btn" @click="showEditDialog(idx)">詳細</button>
                        <button class="admin-btn danger" @click="removeContent(idx)">削除</button>
                        <button class="admin-btn" @click="moveUp(idx)" :disabled="idx === 0">↑</button>
                        <button class="admin-btn" @click="moveDown(idx)"
                            :disabled="idx === localConfig.contents.length - 1">↓</button>
                    </div>
                </li>
            </ul>
        </div>

        <div style="display:flex;align-items:center;gap:12px;">
            <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
                :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
            <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
        </div>
    </div>

    <div v-if="saving" class="modal-overlay">
        <div class="modal-content">
            <h3>保存中...</h3>
            <p>{{ saveStatus }}</p>
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
    <div v-if="dialogVisible" class="modal-overlay">
        <div class="modal-content dialog-modal">
            <h3>{{ editingIndex === -1 ? 'コンテンツを追加' : 'コンテンツを編集' }}</h3>

            <div class="content-controls">
                <label>コンテンツ名:</label>
                <input v-model="(dialogContent as any).name" placeholder="コンテンツ名" class="admin-input" />

                <select v-model="dialogContent.type" class="admin-input">
                    <option value="text">テキスト</option>
                    <option value="image">画像</option>
                    <option value="html">HTML</option>
                </select>

                <input v-if="dialogContent.type === 'text'" v-model="dialogContent.text" placeholder="テキスト内容"
                    class="admin-input" />

                <textarea v-if="dialogContent.type === 'html'" v-model="dialogContent.content" placeholder="HTMLを入力"
                    class="admin-input" rows="6"></textarea>

                <div v-if="dialogContent.type === 'image'">
                    <div class="asset-mode">
                        <label><input type="radio" v-model="dialogContent.imageMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="dialogContent.imageMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="dialogContent.imageMode === 'select'" v-model="dialogContent.assetId"
                        class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <input v-if="dialogContent.imageMode === 'upload'" type="file" @change="onDialogImageChange"
                        accept="image/*" class="admin-input" />
                </div>

                <div class="content-row">
                    <select v-model="dialogContent.effect" class="admin-input">
                        <option value="scroll">スクロール</option>
                        <option value="fade">フェード</option>
                        <option value="static">静止</option>
                    </select>
                    <input v-model.number="dialogContent.duration" type="number" placeholder="表示時間(ms)"
                        class="admin-input" />
                </div>

                <div class="asset-mode">
                    <label><input type="radio" v-model="dialogContent.seMode" value="select" /> SE選択</label>
                    <label><input type="radio" v-model="dialogContent.seMode" value="upload" /> SEアップロード</label>
                </div>
                <select v-if="dialogContent.seMode === 'select'" v-model="dialogContent.seAssetId" class="admin-input">
                    <option value="">選択なし</option>
                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="dialogContent.seMode === 'upload'" type="file" @change="onDialogSeChange" accept="audio/*"
                    class="admin-input" />
            </div>

            <div class="button-row">
                <button class="admin-btn" @click="saveDialog">保存</button>
                <button class="admin-btn" @click="closeDialog">キャンセル</button>
            </div>
        </div>
    </div>

    <UnsavedChangesDialog :visible="showUnsavedDialog" @discard="discardChanges" @cancel="cancelNavigation" />
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import type { OpeningContent } from '@model/domains/screen-config/opening-screen-setting';
import type { Asset } from "@model/domains/drive-data/asset-data";
import { watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import UnsavedChangesDialog from './UnsavedChangesDialog.vue';

const screenSettingsService = container.resolve(ScreenSettingsService);
const assetService = container.resolve(AssetDataService);

const audioAssets = ref<any[]>([]);
const imageAssets = ref<any[]>([]);
const assetUrlMap = new Map<string, string>();
const saving = ref(false);
const saveStatus = ref('');
const syncing = ref(false);
const syncStatus = ref("");

const hasUnsavedChanges = ref(false);
const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const localConfig = ref({
    bgmAssetId: "",
    bgmMode: "select",
    contents: [] as OpeningContent[],
});

const tempAssets: Asset[] = [];

const fetchAssets = async () => {
    try {
        const raw = await assetService.getAllAssetData();
        const mapped = raw.map((a: any) => {
            const copy: any = { ...a };
            if (!copy.url && copy.blob) {
                try {
                    const url = URL.createObjectURL(copy.blob);
                    copy.url = url;
                    if (copy.id) assetUrlMap.set(copy.id, url);
                } catch (err) {
                    console.error('Failed to create object URL for asset', err);
                }
            }
            return copy;
        });
        audioAssets.value = mapped.filter((m: any) => !!m?.type && m.type.startsWith('audio/'));
        imageAssets.value = mapped.filter((m: any) => !!m?.type && m.type.startsWith('image/'));
    } catch (e) {
        audioAssets.value = [];
        imageAssets.value = [];
    }
};

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting('opening', 'opening-screen-settings');
        if (cfg) {
            localConfig.value.bgmAssetId = (cfg as any).bgmAssetId || '';
            localConfig.value.bgmMode = 'select';
            localConfig.value.contents = (cfg as any).contents || [];
        }
    } catch (error) {
        console.error("Failed to load opening config:", error);
    }
};

onMounted(async () => {
    await Promise.all([loadConfig(), fetchAssets()]);
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

const onBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        tempAssets.push(dto);
        localConfig.value.bgmAssetId = dto.id;
    }
};

const dialogVisible = ref(false);
const editingIndex = ref<number>(-1);
const dialogContent = ref<OpeningContent>({
    type: 'text',
    name: '',
    text: '',
    content: '',
    imageMode: 'select',
    assetId: '',
    effect: 'scroll',
    duration: 3000,
    seMode: 'select',
    seAssetId: '',
} as OpeningContent);

const createEmptyContent = (): OpeningContent => ({
    type: 'text',
    name: '',
    text: '',
    content: '',
    imageMode: 'select',
    assetId: '',
    effect: 'scroll',
    duration: 3000,
    seMode: 'select',
    seAssetId: '',
} as OpeningContent);

const showAddDialog = () => {
    editingIndex.value = -1;
    dialogContent.value = JSON.parse(JSON.stringify(createEmptyContent()));
    dialogVisible.value = true;
};

const showEditDialog = (idx: number) => {
    editingIndex.value = idx;
    dialogContent.value = JSON.parse(JSON.stringify(localConfig.value.contents[idx] || createEmptyContent()));
    dialogVisible.value = true;
};

const closeDialog = () => {
    dialogVisible.value = false;
    editingIndex.value = -1;
};

const saveDialog = async () => {
    if (editingIndex.value === -1) {
        localConfig.value.contents.push(JSON.parse(JSON.stringify(dialogContent.value)));
    } else {
        localConfig.value.contents.splice(editingIndex.value, 1, JSON.parse(JSON.stringify(dialogContent.value)));
    }
    closeDialog();
};

const onDialogImageChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        tempAssets.push(dto);
        (dialogContent.value as any).assetId = dto.id;
    }
};

const onDialogSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetService.createDriveDataDtoFromFile(file);
        tempAssets.push(dto);
        (dialogContent.value as any).seAssetId = dto.id;
    }
};

const moveUp = async (idx: number) => {
    if (idx <= 0) return;
    const arr = localConfig.value.contents;
    [arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]];
};

const moveDown = async (idx: number) => {
    const arr = localConfig.value.contents;
    if (idx >= arr.length - 1) return;
    [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
};

const getContentTitle = (c: OpeningContent) => {
    if (!c) return '';
    if ((c as any).name) return (c as any).name;
    if (c.type === 'text') return c.text ? (c.text.length > 30 ? c.text.substr(0, 30) + '…' : c.text) : 'テキスト';
    if (c.type === 'image') return '画像' + (c.assetId ? ` (${c.assetId})` : '');
    if (c.type === 'html') return 'HTML';
    return '';
};

import { onBeforeUnmount } from 'vue';
onBeforeUnmount(() => {
    for (const url of assetUrlMap.values()) {
        try {
            URL.revokeObjectURL(url);
        } catch (e) {

        }
    }
    assetUrlMap.clear();
});

import { computed } from 'vue';
const selectedIndices = ref<number[]>([]);
const isAllSelected = computed({
    get: () => localConfig.value.contents.length > 0 && selectedIndices.value.length === localConfig.value.contents.length,
    set: (val: boolean) => { selectedIndices.value = val ? localConfig.value.contents.map((_, i) => i) : []; }
});

const deleteSelectedContents = async () => {
    if (!selectedIndices.value.length) return;
    const sorted = [...selectedIndices.value].sort((a, b) => b - a);
    for (const idx of sorted) {
        localConfig.value.contents.splice(idx, 1);
    }
    selectedIndices.value = [];
};

const removeContent = async (idx: number) => {
    localConfig.value.contents.splice(idx, 1);
};

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

const handleSaveClick = async () => {
    saving.value = true;
    saveStatus.value = '保存中...';
    try {
        const uploads = tempAssets.length > 0 ? await assetService.addAssetData(tempAssets) : [];
        const payload = {
            bgmAssetId: localConfig.value.bgmAssetId || '',
            contents: localConfig.value.contents,
        };
        await screenSettingsService.saveScreenSetting('opening', 'opening-screen-settings', payload, uploads.length ? uploads : undefined);
        await loadConfig();
        await fetchAssets();
        saveStatus.value = '保存しました';
        hasUnsavedChanges.value = false;
    } catch (err) {
        console.error('Failed to save opening config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const discardChanges = () => {
    showUnsavedDialog.value = false;
    tempAssets.length = 0; // アップロードアセットを破棄
    hasUnsavedChanges.value = false;
    if (pendingRoute.value) {
        pendingRoute.value();
    }
};

const cancelNavigation = () => {
    showUnsavedDialog.value = false;
    pendingRoute.value = null;
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
    margin-bottom: 12px;
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


.admin-input {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.asset-mode {
    flex-wrap: wrap;
}

.content-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 18px;
}

.admin-btn.icon-only {
    padding: 8px;
    border-radius: 8px;
    background: transparent;
    color: #cfe8ff;
    border: 1px solid rgba(255, 255, 255, 0.04);
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.admin-btn.icon-only.add-icon {
    padding: 10px;
    border-radius: 12px;
    background: linear-gradient(180deg, #b6d8ff 0%, #8aaeff 100%);
    color: #232b36;
    border: none;
    box-shadow: 0 6px 18px rgba(79, 140, 255, 0.12);
    display: inline-flex;
    align-items: center;
    justify-content: center;
}

.icon-only .emoji,
.add-icon .emoji {
    font-size: 20px;
    line-height: 1;
}

.admin-btn.icon-only.sync-icon,
.admin-btn.icon-only.delete-icon {
    padding: 8px;
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
    color: #dbeeff;
    border: 1px solid rgba(255, 255, 255, 0.03);
}

.select-all-row {
    margin-bottom: 10px;
    display: flex;
    align-items: center;
}

.select-checkbox {
    width: 20px;
    height: 20px;
    accent-color: #4f8cff;
}

.row-checkbox {
    width: 20px;
    height: 20px;
    accent-color: #4f8cff;
}

.content-list-item {
    display: grid;
    grid-template-columns: 36px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 14px;
    background: #222831;
    border-radius: 8px;
}

.content-thumb {
    width: 64px;
    height: 64px;
    border-radius: 6px;
    object-fit: cover;
    background: #111;
}

.content-summary {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #fff;
}

.content-list-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.add-content-btn {
    display: block;
    width: 100%;
    padding: 12px 18px;
    margin: 8px 0 16px 0;
}

.button-row {
    display: flex;
    gap: 12px;
    margin-top: 12px;
    flex-wrap: wrap;
}

.content-item {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.content-controls {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.content-row {
    display: flex;
    gap: 12px;
}

.content-actions {
    display: flex;
    justify-content: flex-end;
}

.admin-btn.danger {
    background: linear-gradient(90deg, #ff7a7a 0%, #ffb3b3 100%);
    color: #3a1f1f;
}

.empty-note {
    color: #cbd5e1;
    font-size: 0.95rem;
    margin-bottom: 8px;
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

.modal-content.dialog-modal {
    width: min(720px, 92%);
    max-width: 92%;
    padding: 32px 28px;
    text-align: left;
}

.dialog-modal label {
    display: block;
    text-align: left;
    margin-bottom: 8px;
    font-weight: bold;
    color: #fff;
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