<template>
    <div class="admin-section">
        <h2>アセット管理</h2>
        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal" title="Add assets">
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

        <ul v-if="assets.length" class="admin-list">
            <li v-for="asset in assets" :key="asset.id" class="admin-list-item">
                <input type="checkbox" v-model="selectedAssets" :value="asset.id" />
                <div class="asset-preview">
                    <img v-if="asset.type === 'image' && asset.dataUrl" :src="asset.dataUrl" alt="preview"
                        class="preview-img" />
                    <video v-else-if="asset.type === 'video' && asset.dataUrl" :src="asset.dataUrl" controls
                        class="preview-video"></video>
                    <audio v-else-if="asset.type === 'audio' && asset.dataUrl" :src="asset.dataUrl" controls
                        class="preview-audio"></audio>
                    <span v-else>{{ asset.name }}</span>
                </div>
                <div class="asset-info">
                    <span>{{ asset.name }} ({{ asset.type }}) - {{ asset.size }} bytes</span>
                    <div class="usage-info">
                        <strong>使用場所:</strong>
                        <ul>
                            <li v-for="usage in getUsage(asset.id)" :key="usage">{{ usage }}</li>
                        </ul>
                    </div>
                </div>
                <button class="admin-btn ml-2" @click="onPreview(asset)">プレビュー</button>
                <button class="admin-btn ml-2" @click="deleteAsset(asset.id)">削除</button>
            </li>
        </ul>
        <div v-else class="empty-state">
            アセットはありません
        </div>
    </div>
    <div v-if="syncing" class="modal-overlay">
        <div class="modal-content">
            <h3>Google Driveと同期中...</h3>
            <p>{{ syncMessage || "アセットを同期しています。しばらくお待ちください。" }}</p>
            <div class="spinner"></div>
        </div>
    </div>
    <div v-if="deleteAllDeleting" class="modal-overlay">
        <div class="modal-content">
            <h3>全件削除中...</h3>
            <pre>{{ deleteAllMessage }}</pre>
            <div class="spinner"></div>
        </div>
    </div>
    <div v-if="showAddModal" class="modal-overlay">
        <div class="modal-content">
            <h3>アセットを追加</h3>
            <p>追加するファイルを選択してください。</p>
            <input ref="fileInput" type="file" @change="onFileChange" accept="image/*,audio/*,video/*" multiple
                class="admin-input" :disabled="uploading" />
            <div class="selected-files" v-if="selectedFiles.length">
                <strong>選択中（{{ selectedFiles.length }}）:</strong>
                <ul>
                    <li v-for="(f, idx) in selectedFiles" :key="f.name + '-' + idx">
                        <div class="modal-file-row">
                            <span class="file-name">{{ f.name }}</span>
                            <span class="file-size">({{ f.size }} bytes)</span>
                            <span class="file-status" v-if="uploadStatuses[idx]">
                                <template v-if="uploadStatuses[idx].status === '未開始'">(未開始)</template>
                                <template v-else-if="uploadStatuses[idx].status === 'アップロード中'">(アップロード中)</template>
                                <template v-else-if="uploadStatuses[idx].status === '完了'">(完了)</template>
                                <template v-else-if="uploadStatuses[idx].status === '失敗'">(失敗)</template>
                            </span>
                        </div>
                        <div class="file-msg" v-if="uploadStatuses[idx] && uploadStatuses[idx].message">{{
                            uploadStatuses[idx].message }}</div>
                    </li>
                </ul>
            </div>
            <div class="modal-actions">
                <button class="admin-btn" @click="confirmAdd" :disabled="!selectedFiles.length || uploading">追加</button>
                <button class="admin-btn" @click="closeAddModal" :disabled="uploading">キャンセル</button>
            </div>
        </div>
    </div>
    <div v-if="previewAsset" class="modal-overlay" @click.self="closePreview">
        <div class="modal-content">
            <template v-if="previewAssetType === 'audio'">
                <div style="text-align:center;">
                    <h3>音楽プレビュー: {{ previewAsset.name }}</h3>
                    <div style="display:flex;flex-direction:column;align-items:center;">
                        <button class="main-btn" @click="onPlay" :disabled="isLoading || isPlaying">
                            ▶️ 再生
                        </button>
                        <button class="main-btn" @click="onPause" :disabled="!isPlaying">
                            ⏸️ 一時停止
                        </button>
                        <button class="main-btn" @click="onStop" :disabled="!isPlaying">
                            ⏹️ 停止
                        </button>
                        <div v-if="isLoading" style="margin-top:1em;color:#8fd3ff;">ロード中...</div>
                        <div v-if="error" style="margin-top:1em;color:#ff8f8f;">{{ error.message }}</div>
                        <div v-if="duration > 0" style="margin-top:1em;">
                            <span>{{ formatTime(currentTime) }} / {{ formatTime(duration) }}</span>
                        </div>
                    </div>
                </div>
            </template>
            <template v-else-if="previewAssetType === 'image'">
                <div style="display: flex; flex-direction: column; align-items: center;">
                    <img :src="previewAsset.dataUrl" alt="画像プレビュー" style="max-width: 80vw; max-height: 70vh; border-radius: 8px; box-shadow: 0 2px 16px #000a;" />
                    <div v-if="previewAsset.name" style="margin-top: 1em; color: #8fd3ff;">
                        {{ previewAsset.name }}
                    </div>
                </div>
            </template>
            <template v-else-if="previewAssetType === 'video'">
                <div class="video-preview">
                    <video :src="previewAsset.dataUrl" controls class="video-player" />
                    <div v-if="previewAsset.name" class="video-name">
                        {{ previewAsset.name }}
                    </div>
                </div>
            </template>
            <button class="close-btn" @click="closePreview">閉じる</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { AssetService } from '../../../../model/applications/assets/asset-service';
import { container } from 'tsyringe';

const assetService = container.resolve(AssetService);

const assets = ref<any[]>([]);
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

// file input ref used inside add modal
const fileInput = ref<HTMLInputElement | null>(null);

// add modal state and actions
const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; selectedFiles.value = []; uploadStatuses.value = []; };
const confirmAdd = async () => { await addAssets(); closeAddModal(); };
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
const deleteAllDeleting = ref(false);
const deleteAllMessage = ref("");

// preview modal state
const previewAsset = ref<any>(null);
const previewAssetType = ref<string | null>(null);

// audio preview state
const isLoading = ref(false);
const isPlaying = ref(false);
const currentTime = ref(0);
const duration = ref(0);
const error = ref<any>(null);

const fetchAssets = async () => {
    assets.value = await assetService.getAssets();
};

const onFileChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        selectedFiles.value = Array.from(files);
        // initialize upload statuses
        uploadStatuses.value = selectedFiles.value.map(f => ({
            name: f.name,
            size: f.size,
            status: '未開始' as const,
        }));
    }
};

const addAssets = async () => {
    if (!selectedFiles.value.length) return;
    uploading.value = true;
    // アップロード開始時に全てをuploadingに設定
    uploadStatuses.value = selectedFiles.value.map(f => ({
        name: f.name,
        size: f.size,
        status: 'アップロード中' as const,
    }));
    const assetDtos = await Promise.all(selectedFiles.value.map(async (file) => {
        const buf = await file.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const dataUrl = `data:${file.type};base64,${base64}`;
        let type: 'audio' | 'image' | 'video' = 'image';
        if (file.type.includes('audio')) type = 'audio';
        else if (file.type.includes('video')) type = 'video';
        return {
            id: crypto.randomUUID(),
            type,
            dataUrl,
            name: file.name,
            uploadedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            size: buf.byteLength,
            referenceFrom: []
        };
    }));
    await assetService.addAssets(assetDtos);
    uploading.value = false;
    assets.value.push(...assetDtos);
    selectedFiles.value = [];
};

const deleteAsset = async (id: string) => {
    deleteAllDeleting.value = true;
    deleteAllMessage.value = "ファイル削除中...";
    await assetService.deleteAssets([id]);
    assets.value = assets.value.filter(a => a.id !== id);
    deleteAllDeleting.value = false;
};

const deleteSelectedAssets = async () => {
    if (!selectedAssets.value.length) return;
    deleteAllDeleting.value = true;
    deleteAllMessage.value = "ファイル削除中...";
    await assetService.deleteAssets(selectedAssets.value);
    assets.value = assets.value.filter(a => !selectedAssets.value.includes(a.id));
    deleteAllDeleting.value = false;
    selectedAssets.value = [];
};

const syncAssets = async () => {
    syncing.value = true;
    syncMessage.value = "";
    try {
        await assetService.syncAssets();
        await fetchAssets();
    } catch (error) {
        console.error('同期エラー:', error);
    } finally {
        syncing.value = false;
        syncMessage.value = "";
    }
};

const getUsage = (assetId: string) => {
    const asset = assets.value.find(a => a.id === assetId);
    return asset ? asset.referenceFrom : [];
};

// preview functions
const onPreview = (asset: any) => {
    const type = asset.type;
    if (type?.includes('audio')) previewAssetType.value = 'audio';
    else if (type?.includes('image')) previewAssetType.value = 'image';
    else if (type?.includes('video')) previewAssetType.value = 'video';
    else previewAssetType.value = null;
    previewAsset.value = asset;
};

const closePreview = () => {
    previewAsset.value = null;
    previewAssetType.value = null;
};

// audio functions
const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const onPlay = () => { /* audio play logic */ };
const onPause = () => { /* audio pause logic */ };
const onStop = () => { /* audio stop logic */ };

onMounted(async () => {
    await syncAssets();
    await fetchAssets();
});
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

.main-btn {
    font-size: 1em;
    padding: 0.5em 1.2em;
    margin: 0.3em;
    background: #222;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

.main-btn:disabled {
    background: #444;
    color: #aaa;
    cursor: not-allowed;
}

.close-btn {
    margin-top: 1em;
    padding: 0.5em 1.5em;
    background: #444;
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

.close-btn:hover {
    background: #666;
}

.video-preview {
    display: flex;
    flex-direction: column;
    align-items: center;
}

.video-player {
    max-width: 80vw;
    max-height: 70vh;
    border-radius: 8px;
    box-shadow: 0 2px 16px #000a;
}

.video-name {
    margin-top: 1em;
    color: #8fd3ff;
}
</style>
