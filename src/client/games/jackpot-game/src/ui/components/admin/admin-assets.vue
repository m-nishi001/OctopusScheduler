<template>
    <div class="admin-section">
        <h2>アセット管理</h2>
        <form class="admin-form" @submit.prevent="addAssets">
            <input type="file" @change="onFileChange" accept="image/*,audio/*,video/*" multiple class="admin-input" />
            <div v-if="selectedFiles.length" class="selected-files">
                <strong>選択中のファイル（{{ selectedFiles.length }}）:</strong>
                <ul>
                    <li v-for="(f, idx) in selectedFiles" :key="f.name + '-' + idx">
                        <div class="file-row">
                            <span class="file-name">{{ f.name }}</span>
                            <span class="file-size">{{ formatSize(f.size) }}</span>
                            <span class="file-status" v-if="uploadStatuses[idx]">
                                <template v-if="uploadStatuses[idx].status === 'pending'">(未開始)</template>
                                <template v-else-if="uploadStatuses[idx].status === 'uploading'">(アップロード中)</template>
                                <template v-else-if="uploadStatuses[idx].status === 'success'">(完了)</template>
                                <template v-else-if="uploadStatuses[idx].status === 'failed'">(失敗)</template>
                            </span>
                        </div>
                        <div class="file-msg" v-if="uploadStatuses[idx] && uploadStatuses[idx].message">{{
                            uploadStatuses[idx].message }}</div>
                    </li>
                </ul>
            </div>
            <div class="upload-actions">
                <button type="submit" class="admin-btn" :disabled="!selectedFiles.length || uploading">追加</button>
                <span class="uploading-indicator" v-if="uploading">アップロード中...</span>
            </div>
        </form>
        <div class="admin-actions">
            <button class="admin-btn sync-btn" @click="syncAssets" :disabled="syncing">Google Driveと同期</button>
            <button class="admin-btn delete-btn" @click="deleteSelectedAssets"
                :disabled="!selectedAssets.length || syncing">選択したアセットを削除</button>
            <button class="admin-btn delete-all-btn" @click="deleteAllAssets"
                :disabled="!assets.length || syncing || deleteAllDeleting">全件削除</button>
        </div>
        <ul class="admin-list">
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
                    <span>{{ asset.name }} ({{ asset.type }}) - {{ formatSize(asset.size) }}</span>
                    <div class="usage-info">
                        <strong>使用場所:</strong>
                        <ul>
                            <li v-for="usage in getUsage(asset.id)" :key="usage">{{ usage }}</li>
                        </ul>
                    </div>
                </div>
                <button class="admin-btn ml-2" @click="deleteAsset(asset.id)">削除</button>
            </li>
        </ul>
    </div>
    <!-- 同期モーダル -->
    <div v-if="syncing" class="modal-overlay">
        <div class="modal-content">
            <h3>Google Driveと同期中...</h3>
            <p>{{ syncMessage || "アセットを同期しています。しばらくお待ちください。" }}</p>
            <div class="spinner"></div>
        </div>
    </div>
    <!-- 全件削除モーダル -->
    <div v-if="deleteAllDeleting" class="modal-overlay">
        <div class="modal-content">
            <h3>全件削除中...</h3>
            <p>{{ deleteAllMessage }}</p>
            <div class="spinner"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AssetService } from '../../../model/applications/asset-service';
import { container } from 'tsyringe';
const assetService = container.resolve(AssetService);

const assets = ref<any[]>([]);
const selectedFiles = ref<File[]>([]);
const selectedAssets = ref<string[]>([]);

type UploadStatus = {
    name: string;
    size: number;
    status: 'pending' | 'uploading' | 'success' | 'failed';
    message?: string;
}

const uploadStatuses = ref<UploadStatus[]>([]);
const uploading = ref(false);
const syncing = ref(false);
const syncMessage = ref("");
const deleteAllDeleting = ref(false);
const deleteAllMessage = ref("");

// members/prizes/screenConfigs are no longer used directly in this UI; AssetService aggregates usage info
const usageMap = ref<Record<string, string[]>>({});
const deleteMessage = ref('');

const fetchAssets = async () => {
    assets.value = await assetService.fetchAssets();
};

const fetchUsageData = async () => {
    // Use AssetService helper to aggregate usage info from domain services
    const ids = assets.value.map(a => a.id);
    if (ids.length === 0) {
        usageMap.value = {};
        return;
    }
    usageMap.value = await assetService.getUsagesForAssets(ids);
};

const onFileChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        selectedFiles.value = Array.from(files);
        // initialize upload statuses
        uploadStatuses.value = selectedFiles.value.map(f => ({
            name: f.name,
            size: f.size,
            status: 'pending' as const,
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
        status: 'uploading' as const,
    }));
    await assetService.addAssets(selectedFiles.value, (index, success) => {
        // 個別の完了時にステータス更新
        uploadStatuses.value[index].status = success ? 'success' : 'failed';
        uploadStatuses.value[index].message = success ? undefined : 'アップロード失敗';
    });
    uploading.value = false;
    await fetchAssets();
    selectedFiles.value = [];
};

const deleteAsset = async (id: string) => {
    await assetService.deleteAsset(id);
    // サーバー削除成功後にリアルタイムにリストから削除
    assets.value = assets.value.filter(asset => asset.id !== id);
};

const deleteSelectedAssets = async () => {
    if (!selectedAssets.value.length) return;
    await assetService.deleteAssetsWithProgress(selectedAssets.value, ({ id, success, name, completed, total }) => {
        if (success) assets.value = assets.value.filter(a => a.id !== id);
        deleteMessage.value = `${name || id} を削除${success ? '完了' : '失敗'} (${completed}/${total})`;
    });
    selectedAssets.value = [];
};

const deleteAllAssets = async () => {
    deleteAllDeleting.value = true;
    deleteAllMessage.value = "全件削除を開始します...";
    const allIds = assets.value.map(asset => asset.id);
    await assetService.deleteAssetsWithProgress(allIds, ({ id, success, name, completed, total }) => {
        if (success) assets.value = assets.value.filter(a => a.id !== id);
        deleteAllMessage.value = `${name || id} を削除${success ? '完了' : '失敗'} (${completed}/${total})`;
        if (completed === total) {
            deleteAllDeleting.value = false;
            deleteAllMessage.value = "";
        }
    });
};

const syncAssets = async () => {
    syncing.value = true;
    syncMessage.value = "";
    try {
        await assetService.syncAssetsWithGoogleDrive((message) => {
            syncMessage.value = message;
        });
        await fetchAssets();
    } catch (error) {
        console.error('同期エラー:', error);
        // エラー表示を追加可能
    } finally {
        syncing.value = false;
        syncMessage.value = "";
    }
};

const getUsage = (assetId: string) => {
    return usageMap.value[assetId] || [];
};

const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

onMounted(async () => {
    await fetchAssets();
    await fetchUsageData();
});
</script>

<style scoped>
.admin-section {
    margin-bottom: 32px;
}

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
    display: block;
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

.preview-img {
    max-width: 100%;
    max-height: 100%;
    display: block;
}

.preview-video,
.preview-audio {
    max-width: 100%;
    max-height: 100%;
}

.asset-info {
    min-width: 0;
    /* allow text truncation inside grid */
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

.selected-files li {
    font-size: 0.95rem;
    color: #cfe8ff;
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

.admin-list-item button {
    white-space: nowrap;
}
</style>