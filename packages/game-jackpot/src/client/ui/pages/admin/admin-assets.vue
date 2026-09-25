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
            <button class="admin-btn icon-only delete-icon" @click="deleteSelectedAssets"
                :disabled="!selectedAssets.length" title="Delete selected">
                <span class="emoji">🗑️</span>
            </button>
        </div>

        <AssetTable :assets="assets" v-model:selected="selectedAssets" v-model:is-all-selected="isAllSelected"
            :object-url-map="objectUrlMap" @preview="openPreview" />
    </div>

    <div v-if="deleteAllDeleting" class="modal-overlay">
        <div class="modal-content">
            <h3>全件削除中...</h3>
            <pre>{{ deleteAllMessage }}</pre>
            <div class="spinner"></div>
        </div>
    </div>

    <AssetPreviewDialog v-if="previewAsset" :asset="previewAsset" :object-url-map="objectUrlMap"
        @close="previewAsset = null" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';
import { useAssetsList } from './use-assets-list';
import AssetTable from './components/asset-table.vue';
import AssetPreviewDialog from './components/asset-preview-dialog.vue';

const assetDataService = container.resolve(AssetDataService);

const {
    assets,
    selectedAssets,
    isAllSelected,
    deleteAllDeleting,
    deleteAllMessage,
    objectUrlMap,
    fetchAssets,
    deleteSelectedAssets,
    disposeObjectUrls,
} = useAssetsList(assetDataService);

const previewAsset = ref<Asset | null>(null);
const openPreview = (asset: Asset) => { previewAsset.value = asset; };

const selectedFiles = ref<File[]>([]);
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

onMounted(async () => {
    await fetchAssets();
});

onBeforeUnmount(() => {
    disposeObjectUrls();
});
</script>

<style scoped>
.admin-actions {
    margin-bottom: 18px;
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

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

.icon-only .emoji,
.add-icon .emoji {
    font-size: 20px;
    line-height: 1;
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
