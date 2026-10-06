<template>
    <div class="admin-section">
        <input ref="fileInput" type="file" @change="onFileChange" accept="image/*,audio/*,video/*" multiple
            hidden />
        <UiToolbar>
            <UiButton variant="primary" icon="add" @click.prevent="triggerFilePicker">追加</UiButton>
            <UiButton variant="danger" icon="delete" :disabled="!selectedAssets.length"
                @click="deleteSelectedAssets">選択削除</UiButton>
        </UiToolbar>

        <AssetTable :assets="assets" v-model:selected="selectedAssets" :object-url-map="objectUrlMap"
            @preview="openPreview" />
    </div>

    <UiBusyOverlay :visible="deleteAllDeleting" title="全件削除中..." :message="deleteAllMessage" />

    <AssetPreviewDialog v-if="previewAsset" :asset="previewAsset" :object-url-map="objectUrlMap"
        @close="previewAsset = null" />
</template>

<script setup lang="ts">
import { UiBusyOverlay, UiButton, UiToolbar } from '@octopus/ui-kit';
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
