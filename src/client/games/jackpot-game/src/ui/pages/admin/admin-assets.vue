<template>
    <div class="admin-section">
        <h2>アセット管理</h2>
        <div class="admin-actions">
            <input ref="fileInput" type="file" @change="onFileChange" accept="image/*,audio/*,video/*" multiple
                style="display:none" />
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="triggerFilePicker"
                title="Add assets">
                <span class="emoji">➕</span>
            </button>
            <button class="admin-btn icon-only sync-icon" @click="syncAssets" :disabled="syncing"
                :title="'Sync with Google Drive'">
                <span class="emoji">🔄</span>
            </button>
            <button class="admin-btn icon-only delete-icon" @click="deleteSelectedAssets"
                :disabled="!selectedAssets.length || syncing" title="Delete selected">
                <span class="emoji">🗑️</span>
            </button>
        </div>
        <div v-if="assets.length" class="list-controls">
            <label class="select-all-label">
                <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
                <span class="sr-only">全選択</span>
            </label>
        </div>

        <div v-if="assets.length" class="table-wrap">
            <table class="asset-table">
                <thead>
                    <tr>
                        <th style="width:40px"><input type="checkbox" v-model="isAllSelected" /></th>
                        <th style="width:110px">プレビュー</th>
                        <th>ファイル名</th>
                        <th>アセット種別</th>
                        <th style="width:120px">サイズ</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="asset in assets" :key="asset.id">
                        <td><input type="checkbox" v-model="selectedAssets" :value="asset.id" /></td>
                        <td class="thumb-cell">
                            <div class="thumb-wrap">
                                <img v-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('image')) && objectUrlMap.get(asset.id)"
                                    :src="objectUrlMap.get(asset.id)" alt="thumb" class="thumb-img" />

                                <video
                                    v-else-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('video')) && objectUrlMap.get(asset.id)"
                                    :src="objectUrlMap.get(asset.id)" class="thumb-video" muted playsinline></video>

                                <div v-else-if="(asset.blob && asset.blob.type && asset.blob.type.startsWith('audio'))"
                                    class="thumb-audio">
                                    <span>♪</span>
                                </div>

                                <div v-else class="thumb-empty">-</div>
                            </div>
                        </td>
                        <td class="td-name">{{ asset.name }}</td>
                        <td>{{ prettyAssetType(asset.blob?.type) }}</td>
                        <td class="td-size">{{ formatSize(asset.size) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>
        <div v-else class="empty-state">
            アセットはありません
        </div>
    </div>

    <div v-if="showSyncModeModal" class="modal-overlay">
        <div class="modal-content">
            <h3>同期モードを選択</h3>
            <p>同期時にどちらを正としますか？</p>
            <div class="modal-actions">
                <button class="admin-btn" @click.prevent="confirmSyncMode('local')">ローカル優先 (Local wins)</button>
                <button class="admin-btn sync-btn" @click.prevent="confirmSyncMode('drive')">Drive優先 (Drive
                    wins)</button>
                <button class="admin-btn delete-btn" @click.prevent="showSyncModeModal = false">キャンセル</button>
            </div>
        </div>
    </div>

    <div v-if="syncing" class="modal-overlay">
        <div class="modal-content">
            <h3>Google Driveと同期中...</h3>
            <p>{{ syncMessage || "アセットを同期しています。しばらくお待ちください。" }}</p>
            <div class="spinner"></div>
        </div>
    </div>
    <div v-if="showReplaceWarningModal" class="modal-overlay">
        <div class="modal-content">
            <h3>注意: ローカルデータを置換します</h3>
            <p>Drive のコンテンツに合わせてローカルのアセットを置換します。既存のローカルアセットは削除されます。続行しますか？</p>
            <div class="modal-actions">
                <button class="admin-btn delete-btn" @click.prevent="showReplaceWarningModal = false">キャンセル</button>
                <button class="admin-btn sync-btn" @click.prevent="performReplaceFromDrive">置換して同期する</button>
            </div>
        </div>
    </div>
    <div v-if="deleteAllDeleting" class="modal-overlay">
        <div class="modal-content">
            <h3>全件削除中...</h3>
            <pre>{{ deleteAllMessage }}</pre>
            <div class="spinner"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import type { Asset } from '../../../model/domains/drive-data/asset-data';
import { container } from 'tsyringe';

function formatSize(size: number): string {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
const assetDataService = container.resolve(AssetDataService);

const assets = ref<Asset[]>([]);
const selectedFiles = ref<File[]>([]);
const selectedAssets = ref<string[]>([]);

const isAllSelected = computed({
    get: () => {
        return assets.value.length > 0 && selectedAssets.value.length === assets.value.length;
    },
    set: (val: boolean) => {
        if (val) {
            selectedAssets.value = assets.value.map(a => a.id);
        } else {
            selectedAssets.value = [];
        }
    }
});

const fileInput = ref<HTMLInputElement | null>(null);

const triggerFilePicker = () => {
    if (fileInput.value) fileInput.value.click();
};
type UploadStatus = {
    name: string;
    size: number;
    status: '未開始' | 'アップロード中' | '完了' | '失敗';
    message?: string;
}

const uploadStatuses = ref<UploadStatus[]>([]);
const uploading = ref(false);
const syncing = ref(false);
const syncMessage = ref("");
const showSyncModeModal = ref(false);
const showReplaceWarningModal = ref(false);
const pendingSyncMode = ref<"drive" | "local" | null>(null);
const deleteAllDeleting = ref(false);
const deleteAllMessage = ref("");

const objectUrlMap = new Map<string, string>();

const fetchAssets = async () => {
    assets.value = await assetDataService.getAllAssetData();
    for (const a of assets.value) {
        try {
            if (a.id && !objectUrlMap.has(a.id)) {
                objectUrlMap.set(a.id, URL.createObjectURL(a.blob));
            }
        } catch (e) { }
    }
};

const onFileChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        selectedFiles.value = Array.from(files);
        uploadStatuses.value = selectedFiles.value.map(f => ({
            name: f.name,
            size: f.size,
            status: '未開始' as const,
        }));
        setTimeout(() => addAssets(), 50);
    }
};

const addAssets = async () => {
    if (!selectedFiles.value.length) return;
    uploading.value = true;
    uploadStatuses.value = selectedFiles.value.map(f => ({
        name: f.name,
        size: f.size,
        status: 'アップロード中' as const,
    }));

    const assetDtos = await Promise.all(selectedFiles.value.map(async (file, idx) => {
        const dto = await assetDataService.createDriveDataDtoFromFile(file);
        const key = dto.id || `tmp-${Date.now()}-${idx}`;
        try { objectUrlMap.set(key, URL.createObjectURL(file)); } catch { }
        return dto;
    }));
    uploadStatuses.value = uploadStatuses.value.map(u => ({ ...u, status: 'アップロード中' }));
    let updatedAssets: Asset[] = [];
    try {
        updatedAssets = await assetDataService.addAssetData(assetDtos);
    } catch (e) {
        uploadStatuses.value = uploadStatuses.value.map(u => ({ ...u, status: '失敗', message: (e as Error).message }));
        console.error('Failed to add assets', e);
        uploading.value = false;
        return;
    }


    if (updatedAssets.length === uploadStatuses.value.length) {
        for (let i = 0; i < uploadStatuses.value.length; i++) {
            uploadStatuses.value[i] = { ...uploadStatuses.value[i], status: '完了' };
        }
    } else {
        const byName = new Map<string, Asset[]>();
        for (const ua of updatedAssets) {
            if (!ua.name) continue;
            const list = byName.get(ua.name) || [];
            list.push(ua);
            byName.set(ua.name, list);
        }
        uploadStatuses.value = uploadStatuses.value.map(u => {
            const list = byName.get(u.name);
            if (list && list.length > 0) {
                // consume one
                list.shift();
                return { ...u, status: '完了' };
            }
            return { ...u, status: '失敗' };
        });
    }

    for (const ua of updatedAssets) {
        if (ua.id) {
            const tmpKey = Array.from(objectUrlMap.keys()).find(k => k.startsWith('tmp-') && objectUrlMap.get(k)?.includes(ua.name || ''));
            if (tmpKey) {
                const url = objectUrlMap.get(tmpKey)!;
                objectUrlMap.delete(tmpKey);
                objectUrlMap.set(ua.id, url);
            }
        }
    }

    uploading.value = false;
    assets.value.push(...updatedAssets);
    selectedFiles.value = [];
};

onBeforeUnmount(() => {
    for (const url of objectUrlMap.values()) {
        try { URL.revokeObjectURL(url); } catch { }
    }
    objectUrlMap.clear();
});


const deleteSelectedAssets = async () => {
    if (!selectedAssets.value.length) return;
    deleteAllDeleting.value = true;
    deleteAllMessage.value = "ファイル削除中...";
    const progressList = selectedAssets.value.map(id => {
        const asset = assets.value.find(a => a.id === id);
        return { id, name: asset?.name || id, status: '削除中' as '削除中' | '削除済' | '削除失敗' };
    });
    await assetDataService.deleteAssetData(selectedAssets.value, ({ id, success }) => {
        const item = progressList.find(p => p.id === id);
        if (item) {
            item.status = success ? '削除済' : '削除失敗';
        }
        deleteAllMessage.value = `ファイル削除中...\n${progressList.map(p => `${p.name}：${p.status}`).join('\n')}`;
        if (success) assets.value = assets.value.filter(a => a.id !== id);
    });
    for (const id of selectedAssets.value) {
        const url = objectUrlMap.get(id);
        if (url) {
            try { URL.revokeObjectURL(url); } catch { }
            objectUrlMap.delete(id);
        }
    }
    deleteAllDeleting.value = false;
    selectedAssets.value = [];
};

selectedAssets.value = [];

const syncAssets = async () => {
    showSyncModeModal.value = true;
};

const confirmSyncMode = async (mode: "drive" | "local") => {
    showSyncModeModal.value = false;
    if (mode === 'drive') {
        pendingSyncMode.value = 'drive';
        showReplaceWarningModal.value = true;
        return;
    }

    // local wins: upload diffs (existing behavior)
    syncing.value = true;
    syncMessage.value = "";
    try {
        await assetDataService.syncAssetData((message) => {
            syncMessage.value = message;
        });
        await fetchAssets();
    } catch (error) {
        console.error('同期エラー:', error);
    } finally {
        syncing.value = false;
        syncMessage.value = "";
    }
};

const performReplaceFromDrive = async () => {
    showReplaceWarningModal.value = false;
    if (pendingSyncMode.value !== 'drive') return;
    pendingSyncMode.value = null;
    syncing.value = true;
    syncMessage.value = "";
    try {
        await assetDataService.replaceLocalWithDrive((message) => {
            syncMessage.value = message;
        });
        await fetchAssets();
    } catch (error) {
        console.error('同期エラー:', error);
    } finally {
        syncing.value = false;
        syncMessage.value = "";
    }
};


onMounted(async () => {
    await fetchAssets();
});



function prettyAssetType(mime: string | undefined): string {
    if (!mime) return 'file';
    if (mime.startsWith('image')) return '画像';
    if (mime.startsWith('video')) return '動画';
    if (mime.startsWith('audio')) return '音楽';
    return mime;
}
</script>

<style scoped>
.admin-form {
    display: flex;
    gap: 16px;
    margin-bottom: 18px;
    flex-wrap: wrap;
    align-items: center;
}

.admin-input {
    padding: 10px 14px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 0.98rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

/* Primary action look */
.admin-btn {
    padding: 9px 18px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: 700;
    cursor: pointer;
    transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.admin-btn:hover {
    box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
}

.admin-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.delete-btn,
.delete-all-btn {
    background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover,
.delete-all-btn:hover {
    box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
}

.admin-actions {
    margin-bottom: 18px;
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.admin-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.list-controls {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
}

.select-all-checkbox {
    width: 20px;
    height: 20px;
    margin: 0;
    vertical-align: middle;
    /* Use same look as list checkboxes (native) */
}

.select-all-label {
    /* tweak to align with item checkbox column */
    margin-left: 10px;
}

.admin-list-item {
    background: #232b36;
    color: #fff;
    padding: 14px;
    border-radius: 10px;
    margin-bottom: 12px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
    display: grid;
    grid-template-columns: 36px 110px 1fr auto;
    gap: 14px;
    align-items: center;
}

.admin-list-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    justify-self: center;
}

.asset-preview {
    width: 110px;
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2a3137;
    border-radius: 6px;
    overflow: hidden;
}

.preview-img,
.preview-video,
.preview-audio {
    max-width: 100%;
    max-height: 100%;
    display: block;
}

.asset-info {
    min-width: 0;
}

.usage-info ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0 0;
}

.usage-info li {
    font-size: 0.9em;
    color: #c9d7e6;
}

.ml-2 {
    margin-left: 8px;
}

.selected-files {
    width: 100%;
    color: #ddd;
    margin-top: 8px;
}

.selected-files ul {
    list-style: none;
    padding: 8px 12px;
    margin: 4px 0 0 0;
    background: #1e262d;
    border-radius: 6px;
}

/* Styles specifically when selected-files appears inside modal */
.modal-content .selected-files ul {
    padding: 12px 16px;
    background: linear-gradient(180deg, rgba(28, 34, 40, 0.9) 0%, rgba(27, 30, 35, 0.85) 100%);
    border-radius: 8px;
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.02);
}

.modal-file-row {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 10px;
    padding: 8px 6px;
}

.modal-content .file-name {
    font-weight: 700;
    color: #e7f6ff;
}

.modal-content .file-size {
    color: #9fb7d6;
}

.modal-content .file-status {
    color: #ffd580;
    margin-left: 6px;
}

.file-row {
    display: flex;
    gap: 12px;
    align-items: center;
}

.file-name {
    font-weight: 600;
}

.file-size {
    color: #9fb7d6;
    font-size: 0.9rem;
}

.file-status {
    margin-left: 8px;
    color: #ffd580;
}

.file-msg {
    color: #ff9b9b;
    font-size: 0.85rem;
}

.uploading-indicator {
    margin-left: 12px;
    color: #cfe8ff;
    font-weight: 700;
}

.upload-actions {
    display: flex;
    align-items: center;
    gap: 16px;
}

.sync-btn {
    background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
}

.sync-btn:hover {
    box-shadow: 0 6px 18px rgba(32, 201, 151, 0.12);
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
    text-align: left;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 720px;
    width: 90%;
}

.modal-actions {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
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

.admin-list-item button {
    white-space: nowrap;
}

.visually-hidden {
    position: absolute !important;
    height: 1px;
    width: 1px;
    overflow: hidden;
    clip: rect(1px, 1px, 1px, 1px);
    white-space: nowrap;
    border: 0;
    padding: 0;
    margin: -1px;
}

.icon-only {
    padding: 8px;
    border-radius: 8px;
    background: transparent;
    color: #cfe8ff;
    border: 1px solid rgba(255, 255, 255, 0.04);
}

.icon-only:hover {
    background: rgba(255, 255, 255, 0.02);
}

/* Add button specific style: make it visually prominent but match small icon sizing */
.add-icon {
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

.add-icon:hover {
    transform: translateY(-2px);
}

.select-all-icon {
    /* visually distinct but subtle */
    border-radius: 8px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
    color: #dbeeff;
}

.select-all-icon .emoji {
    font-weight: 700;
}

.icon-btn svg,
.admin-btn svg {
    display: inline-block;
}

.icon-only .emoji,
.add-icon .emoji {
    font-size: 20px;
    line-height: 1;
}

.sr-only {
    position: absolute !important;
    height: 1px;
    width: 1px;
    overflow: hidden;
    clip: rect(1px, 1px, 1px, 1px);
    white-space: nowrap;
    border: 0;
    padding: 0;
    margin: -1px;
}

.table-wrap {
    max-height: 360px;
    overflow: auto;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 6px;
}

.asset-table {
    width: 100%;
    border-collapse: collapse;
    color: #fff;
    min-width: 640px;
}

.asset-table thead th {
    background: #111315;
    padding: 12px 10px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    text-align: left;
    font-weight: 700;
    color: #dbeeff;
}

.asset-table tbody td {
    padding: 10px 12px;
    border-bottom: 1px dashed rgba(255, 255, 255, 0.03);
    vertical-align: middle;
}

.td-name {
    font-weight: 700;
    color: #fff;
}

.td-size {
    text-align: right;
    color: #c9d7e6;
}

.asset-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.02);
}

.thumb-cell {
    padding: 6px 8px;
}

.thumb-wrap {
    width: 96px;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #1f262b;
    border-radius: 4px;
    overflow: hidden;
}

.thumb-img {
    max-width: 100%;
    max-height: 100%;
    display: block;
}

.thumb-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.thumb-audio {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #cfe8ff;
    font-weight: 700;
}

.thumb-empty {
    color: #9fb7d6;
}
</style>