<template>
    <div class="admin-section">
        <h2>アセット管理</h2>

        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal"
                title="Add assets">➕</button>
            <button class="admin-btn icon-only sync-icon" @click="syncAssets" :disabled="syncing"
                title="Sync with Google Drive">🔄</button>
            <button class="admin-btn icon-only delete-icon" @click="deleteSelectedAssets"
                :disabled="!selectedAssets.length || syncing" title="Delete selected">🗑️</button>
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
                </div>
                <button class="admin-btn ml-2" @click="onPreview(asset)">プレビュー</button>
                <button class="admin-btn ml-2" @click="deleteAsset(asset.id)">削除</button>
            </li>
        </ul>

        <div v-else class="empty-state">アセットはありません</div>

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
                                <span class="file-status" v-if="uploading">(保存中...)</span>
                            </div>
                        </li>
                    </ul>
                </div>

                <div class="modal-actions">
                    <button class="admin-btn" @click="confirmAdd"
                        :disabled="!selectedFiles.length || uploading">追加</button>
                    <button class="admin-btn" @click="closeAddModal" :disabled="uploading">キャンセル</button>
                </div>
            </div>
        </div>

        <div v-if="previewAsset" class="modal-overlay" @click.self="closePreview">
            <div class="modal-content">
                <div v-if="previewAssetType === 'image'">
                    <img :src="previewAsset.dataUrl" alt="preview" style="max-width:80vw;max-height:70vh" />
                </div>
                <div v-else-if="previewAssetType === 'audio'">
                    <audio :src="previewAsset.dataUrl" controls />
                </div>
                <div v-else-if="previewAssetType === 'video'">
                    <video :src="previewAsset.dataUrl" controls style="max-width:80vw;max-height:70vh" />
                </div>
                <button class="close-btn" @click="closePreview">閉じる</button>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';

const assetService = container.resolve(AssetService);

const assets = ref<any[]>([]);
const selectedFiles = ref<File[]>([]);
const selectedAssets = ref<string[]>([]);

const isAllSelected = computed({
    get: () => assets.value.length > 0 && selectedAssets.value.length === assets.value.length,
    set: (val: boolean) => { selectedAssets.value = val ? assets.value.map(a => a.id) : []; }
});

const fileInput = ref<HTMLInputElement | null>(null);
const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; selectedFiles.value = []; };
const confirmAdd = async () => { await addAssets(); closeAddModal(); };

const uploading = ref(false);
const syncing = ref(false);

const previewAsset = ref<any>(null);
const previewAssetType = ref<string | null>(null);

const fetchAssets = async () => { assets.value = await assetService.getAssets(); };

const onFileChange = (e: Event) => { const files = (e.target as HTMLInputElement).files; if (files) selectedFiles.value = Array.from(files); };

const addAssets = async () => {
    if (!selectedFiles.value.length) return;
    uploading.value = true;
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
        };
    }));
    try {
        await assetService.addAssets(assetDtos);
        assets.value.push(...assetDtos);
    } finally {
        uploading.value = false;
        selectedFiles.value = [];
    }
};

const deleteAsset = async (id: string) => { await assetService.deleteAssets([id]); assets.value = assets.value.filter(a => a.id !== id); };
const deleteSelectedAssets = async () => { if (!selectedAssets.value.length) return; await assetService.deleteAssets(selectedAssets.value); assets.value = assets.value.filter(a => !selectedAssets.value.includes(a.id)); selectedAssets.value = []; };

const syncAssets = async () => { syncing.value = true; try { await assetService.syncAssets(); await fetchAssets(); } finally { syncing.value = false; } };

const onPreview = (asset: any) => { previewAsset.value = asset; previewAssetType.value = asset.type; };
const closePreview = () => { previewAsset.value = null; previewAssetType.value = null; };

onMounted(async () => { await fetchAssets(); });
</script>

<style scoped>
.admin-input {
    padding: 10px 14px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
}

.admin-btn {
    padding: 8px 12px;
    border-radius: 8px;
}

.admin-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.admin-list-item {
    display: grid;
    grid-template-columns: 36px 110px 1fr auto;
    gap: 12px;
    align-items: center;
    padding: 12px;
}

.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-content {
    background: #232b36;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    max-width: 720px;
    width: 90%;
}
</style>
