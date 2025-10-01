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
            <p>アセットを同期しています。しばらくお待ちください。</p>
            <div class="spinner"></div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AssetService } from '../../../model/applications/asset-service';
import { MemberService } from '../../../model/applications/member-service';
import { PrizeService } from '../../../model/applications/prize-service';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';

import { container } from 'tsyringe';
const assetService = container.resolve(AssetService);
const memberService = container.resolve(MemberService);
const prizeService = container.resolve(PrizeService);
const screenConfigService = container.resolve(ScreenConfigService);

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

const members = ref<any[]>([]);
const prizes = ref<any[]>([]);
const screenConfigs = ref<any[]>([]);

const fetchAssets = async () => {
    assets.value = await assetService.fetchAssets();
};

const fetchUsageData = async () => {
    members.value = await memberService.fetchMembers();
    prizes.value = await prizeService.fetchPrizes();
    const screenTypes = ['home', 'opening', 'description', 'demo', 'main', 'result', 'admin'];
    screenConfigs.value = await Promise.all(screenTypes.map(type => screenConfigService.fetchScreenConfig(type)));
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
    await assetService.deleteAssets(selectedAssets.value);
    // サーバー削除成功後にリアルタイムにリストから削除
    assets.value = assets.value.filter(asset => !selectedAssets.value.includes(asset.id));
    selectedAssets.value = [];
    // 必要に応じて同期（今回はローカルストレージが更新されているので不要）
    // await fetchAssets();
};

const syncAssets = async () => {
    syncing.value = true;
    try {
        await assetService.syncAssetsWithGoogleDrive();
        await fetchAssets();
    } catch (error) {
        console.error('同期エラー:', error);
        // エラー表示を追加可能
    } finally {
        syncing.value = false;
    }
};

const getUsage = (assetId: string) => {
    const usages: string[] = [];
    // Members
    members.value.forEach(member => {
        if (member.photoAssetId === assetId) {
            usages.push(`メンバー: ${member.name}`);
        }
    });
    // Prizes
    prizes.value.forEach(prize => {
        if (prize.imageAssetId === assetId) {
            usages.push(`景品: ${prize.name} (画像)`);
        }
        if (prize.bgm1AssetId === assetId) {
            usages.push(`景品: ${prize.name} (BGM1)`);
        }
        if (prize.bgm2AssetId === assetId) {
            usages.push(`景品: ${prize.name} (BGM2)`);
        }
    });
    // ScreenConfigs
    screenConfigs.value.forEach(config => {
        if (config.bgmAssetId === assetId) {
            usages.push(`画面設定: ${config.type} (BGM)`);
        }
        if (config.seAssetIds && config.seAssetIds.includes(assetId)) {
            usages.push(`画面設定: ${config.type} (SE)`);
        }
        config.elements.forEach((element: any) => {
            if (element.assetId === assetId) {
                usages.push(`画面設定: ${config.type} (要素: ${element.type})`);
            }
        });
    });
    return usages;
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
    margin-bottom: 24px;
    flex-wrap: wrap;
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 1rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
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

.admin-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.delete-btn {
    background: linear-gradient(90deg, #ff4f4f 0%, #ffaeae 100%);
}

.delete-btn:hover {
    background: linear-gradient(90deg, #ffaeae 0%, #ff4f4f 100%);
}

.admin-actions {
    margin-bottom: 16px;
}

.admin-list {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.admin-list-item {
    background: #232b36;
    color: #fff;
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.asset-preview {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    border-radius: 4px;
}

.preview-img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 4px;
}

.preview-video,
.preview-audio {
    max-width: 100%;
    max-height: 100%;
}

.asset-info {
    flex: 1;
}

.usage-info ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0 0;
}

.usage-info li {
    font-size: 0.9em;
    color: #ccc;
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
    gap: 8px;
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
    gap: 12px;
}

.sync-btn {
    background: linear-gradient(90deg, #28a745 0%, #20c997 100%);
}

.sync-btn:hover {
    background: linear-gradient(90deg, #20c997 0%, #28a745 100%);
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
    padding: 32px;
    border-radius: 8px;
    text-align: center;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
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