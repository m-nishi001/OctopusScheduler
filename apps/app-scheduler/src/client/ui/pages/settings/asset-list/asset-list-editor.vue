<template>
    <div class="asset-list-editor">
        <UiToolbar>
            <UiButton variant="primary" icon="add" @click.prevent="openAddModal">追加</UiButton>
            <UiButton variant="danger" icon="delete" :disabled="!selectedAssets.length"
                @click="deleteSelectedAssets">選択削除</UiButton>
        </UiToolbar>

        <DataTable :columns="columns" :rows="rows" row-key="id" selectable v-model:selected="selectedAssets"
            empty-text="アセットはありません">
            <template #cell-preview="{ row }">
                <img v-if="row.kind === 'image' && row.asset.url" :src="row.asset.url" alt="preview"
                    class="preview-thumb" />
                <video v-else-if="row.kind === 'video' && row.asset.url" :src="row.asset.url" controls
                    class="preview-thumb"></video>
                <audio v-else-if="row.kind === 'audio' && row.asset.url" :src="row.asset.url" controls
                    class="preview-audio"></audio>
                <span v-else>{{ row.name }}</span>
            </template>
            <template #cell-actions="{ row }">
                <div class="row-actions">
                    <UiButton size="sm" icon="play" icon-only aria-label="プレビュー" @click="onPreview(row.asset)" />
                    <UiButton size="sm" variant="danger" icon="delete" icon-only aria-label="削除"
                        @click="deleteAsset(row.id)" />
                </div>
            </template>
        </DataTable>

        <UiDialog :model-value="showAddModal" title="アセットを追加" size="md" :persistent="uploading"
            confirm-label="追加" :loading="uploading" :confirm-disabled="!selectedFiles.length"
            @confirm="confirmAdd" @cancel="closeAddModal" @close="closeAddModal">
            <p class="modal-lead">追加するファイルを選択してください。</p>
            <input ref="fileInput" type="file" @change="onFileChange" accept="image/*,audio/*,video/*" multiple
                class="file-input" :disabled="uploading" />

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
        </UiDialog>

        <!-- per-screen sync removed: background sync (useBackgroundSync) runs automatically -->

        <!-- Drive->Local replace flow removed (use Bulk Sync which handles backups and confirmations) -->

        <UiDialog :model-value="!!previewAsset" title="プレビュー" size="lg" @close="closePreview">
            <template v-if="previewAsset">
                <img v-if="previewAssetType === 'image'" :src="previewAsset.url" alt="preview" class="preview-media" />
                <audio v-else-if="previewAssetType === 'audio'" :src="previewAsset.url" controls />
                <video v-else-if="previewAssetType === 'video'" :src="previewAsset.url" controls class="preview-media" />
            </template>
            <template #footer>
                <UiButton @click="closePreview">閉じる</UiButton>
            </template>
        </UiDialog>

    </div>
</template>

<script setup lang="ts">
import { DataTable, UiButton, UiDialog, UiToolbar, useConfirm } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../control/asset/asset-service';

const assetService = container.resolve(AssetService);

const assets = ref<any[]>([]);
// map of asset.id -> object URL created for UI preview
const objectUrlMap = new Map<string, string>();
const selectedFiles = ref<File[]>([]);
const selectedAssets = ref<string[]>([]);

const columns: DataTableColumn[] = [
    { key: 'preview', label: 'プレビュー' },
    { key: 'name', label: 'アセット名', sortable: true },
    { key: 'kind', label: '種別', sortable: true },
    { key: 'sizeLabel', label: 'サイズ' },
    { key: 'actions', label: '操作' },
];

const rows = computed(() =>
    assets.value.map((asset) => ({
        id: asset.id,
        name: asset.name,
        kind: deriveAssetKind(asset),
        sizeLabel: `${(asset.size / 1024 / 1024).toFixed(2)} MB`,
        asset,
    }))
);

const { confirmDelete } = useConfirm();

const fileInput = ref<HTMLInputElement | null>(null);
const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };
const closeAddModal = () => { showAddModal.value = false; selectedFiles.value = []; };
const confirmAdd = async () => { await addAssets(); closeAddModal(); };

const uploading = ref(false);
// per-screen syncing removed; assets sync automatically in the background

const previewAsset = ref<any>(null);
const previewAssetType = ref<string | null>(null);

const fetchAssets = async () => {
    const raw = await assetService.getAssets();
    // create object URLs for UI preview when blob exists
    assets.value = raw.map(a => {
        const copy: any = { ...a };
        if (!copy.url && copy.blob) {
            try {
                const url = URL.createObjectURL(copy.blob);
                copy.url = url;
                if (copy.id) objectUrlMap.set(copy.id, url);
            } catch (err) {
                console.error('Failed to create object URL for asset', err);
            }
        }
        return copy;
    });
};

const onFileChange = (e: Event) => { const files = (e.target as HTMLInputElement).files; if (files) selectedFiles.value = Array.from(files); };

const addAssets = async () => {
    if (!selectedFiles.value.length) return;
    uploading.value = true;
    const assetPairs = selectedFiles.value.map((file) => {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const assetForStore: any = {
            id,
            blob: file,
            name: file.name,
            uploadedAt: now,
            lastUpdated: now,
            size: file.size,
        };
        const assetForUI = { ...assetForStore, url: URL.createObjectURL(file) };
        return { store: assetForStore, ui: assetForUI };
    });
    try {
        // store assets (persist blobs)
        await assetService.addAssets(assetPairs.map(p => p.store));
        // push UI copies with object URLs and register in map
        for (const p of assetPairs) {
            assets.value.push(p.ui);
            if (p.ui.id) objectUrlMap.set(p.ui.id, p.ui.url);
        }
    } finally {
        uploading.value = false;
        selectedFiles.value = [];
    }
};

const deleteAsset = async (id: string) => {
    if (!(await confirmDelete('このアセットを削除しますか?'))) return;
    await assetService.deleteAssets([id]);
    // revoke object URL if we created one
    const url = objectUrlMap.get(id);
    if (url) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
        objectUrlMap.delete(id);
    }
    assets.value = assets.value.filter(a => a.id !== id);
};
const deleteSelectedAssets = async () => {
    if (!selectedAssets.value.length) return;
    if (!(await confirmDelete(`選択した${selectedAssets.value.length}件のアセットを削除しますか?`))) return;
    await assetService.deleteAssets(selectedAssets.value);
    // revoke urls
    for (const id of selectedAssets.value) {
        const url = objectUrlMap.get(id);
        if (url) {
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
            objectUrlMap.delete(id);
        }
    }
    assets.value = assets.value.filter(a => !selectedAssets.value.includes(a.id));
    selectedAssets.value = [];
};

// per-screen sync functions removed; syncing is handled by the background sync engine

const onPreview = (asset: any) => { previewAsset.value = asset; previewAssetType.value = deriveAssetKind(asset); };
const closePreview = () => { previewAsset.value = null; previewAssetType.value = null; };

onBeforeUnmount(() => {
    // revoke all created object URLs
    for (const url of objectUrlMap.values()) {
        try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
    }
    objectUrlMap.clear();
});

onMounted(async () => { await fetchAssets(); });

function deriveAssetKind(asset: any): string {
    // blob is guaranteed to be present; use it directly.
    const mime = asset.blob.type;
    if (typeof mime === 'string') {
        if (mime.startsWith('image')) return 'image';
        if (mime.startsWith('video')) return 'video';
        if (mime.startsWith('audio')) return 'audio';
    }
    return 'file';
}
</script>

<style scoped>
.row-actions {
    display: flex;
    gap: var(--ui-space-2, 8px);
}

.preview-thumb {
    display: block;
    max-width: 120px;
    max-height: 80px;
    object-fit: contain;
}

.preview-audio {
    max-width: 100%;
}

.selected-files ul {
    margin: var(--ui-space-1, 4px) 0 0;
    padding-left: 1.2em;
    font-size: var(--ui-font-sm, 0.875rem);
}

.modal-lead {
    margin: 0 0 var(--ui-space-3, 12px);
    color: var(--ui-text-muted, #cfd6dd);
}

.preview-media {
    display: block;
    max-width: 100%;
    max-height: 70dvh;
    margin: 0 auto;
}
</style>
