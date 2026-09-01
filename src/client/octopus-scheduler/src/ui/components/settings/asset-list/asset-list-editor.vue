<template>
    <div class="admin-section">
        <h2 class="editor-title"><span class="editor-icon">🗂️</span> アセット管理</h2>

        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal"
                title="Add assets">➕</button>
            <button class="admin-btn icon-only delete-icon" @click="deleteSelectedAssets"
                :disabled="!selectedAssets.length" title="Delete selected">🗑️</button>
        </div>



        <ul v-if="assets.length" class="admin-list">
            <li class="admin-list-header" aria-hidden="true">
                <div class="header-checkbox">
                    <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
                </div>
                <div class="header-preview">プレビュー</div>
                <div class="header-name">アセット名</div>
                <div class="header-kind">種別</div>
                <div class="header-size">サイズ</div>
                <div class="header-actions">操作</div>
            </li>
            <li v-for="asset in assets" :key="asset.id" class="admin-list-item">
                <div class="row-checkbox">
                    <input type="checkbox" v-model="selectedAssets" :value="asset.id" />
                </div>
                <div class="asset-preview">
                    <img v-if="deriveAssetKind(asset) === 'image' && asset.url" :src="asset.url" alt="preview"
                        class="preview-img" />
                    <video v-else-if="deriveAssetKind(asset) === 'video' && asset.url" :src="asset.url" controls
                        class="preview-video"></video>
                    <audio v-else-if="deriveAssetKind(asset) === 'audio' && asset.url" :src="asset.url" controls
                        class="preview-audio"></audio>
                    <span v-else>{{ asset.name }}</span>
                </div>
                <div class="asset-info">
                    <div class="asset-name">{{ asset.name }}</div>
                </div>
                <div class="asset-kind-col">
                    <span class="asset-kind">{{ deriveAssetKind(asset) }}</span>
                </div>
                <div class="asset-size-col">
                    <span class="asset-size">{{ (asset.size / 1024 / 1024).toFixed(2) }} MB</span>
                </div>
                <div class="asset-actions">
                    <button class="admin-btn" @click="onPreview(asset)">プレビュー</button>
                    <button class="admin-btn delete-btn" @click="deleteAsset(asset.id)">削除</button>
                </div>
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

        <!-- per-screen sync removed: use 一括同期 (Bulk Sync) in header -->

        <!-- Drive->Local replace flow removed (use Bulk Sync which handles backups and confirmations) -->

        <div v-if="previewAsset" class="modal-overlay" @click.self="closePreview">
            <div class="modal-content">
                <div v-if="previewAssetType === 'image'">
                    <img :src="previewAsset.url" alt="preview" style="max-width:80vw;max-height:70vh" />
                </div>
                <div v-else-if="previewAssetType === 'audio'">
                    <audio :src="previewAsset.url" controls />
                </div>
                <div v-else-if="previewAssetType === 'video'">
                    <video :src="previewAsset.url" controls style="max-width:80vw;max-height:70vh" />
                </div>
                <button class="close-btn" @click="closePreview">閉じる</button>
            </div>
        </div>

    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../model/applications/assets/asset-service';

const assetService = container.resolve(AssetService);

const assets = ref<any[]>([]);
// map of asset.id -> object URL created for UI preview
const objectUrlMap = new Map<string, string>();
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
// per-screen syncing removed; bulk sync is used from header dialog

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

// per-screen sync functions removed; assetService.syncAssets remains for bulk orchestration

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

/* larger icon-only buttons used in the admin actions (top-left) */
.admin-actions .admin-btn.icon-only {
    width: 48px;
    height: 48px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 1.4rem;
    border-radius: 12px;
}

.admin-actions {
    display: flex;
    gap: 8px;
    align-items: center;
}

.editor-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 36px;
}

.editor-icon {
    font-size: 1.3em;
}

.admin-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

/* Table-like container to give a clear outer border */
.admin-list {
    list-style: none;
    padding: 0;
    margin: 0;
    /* use table layout so cell borders can collapse and draw continuous vertical lines */
    display: table;
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    /* card-like table: subtle background, outer border and drop shadow for lift */
    background: rgba(255, 255, 255, 0.01);
    border: 1px solid rgba(255, 255, 255, 0.18);
    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.65), 0 1px 0 rgba(0, 0, 0, 0.6) inset;
    border-radius: 14px;
    overflow: hidden;
    /* stronger inner padding so content has breathing room */
    padding: 28px 28px;
    margin-top: 8px;
}

.admin-list-item {
    /* table-row so that cells align and borders collapse */
    display: table-row;
}

.asset-preview {
    width: 120px;
    height: 80px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: transparent;
    padding: 0;
}

.asset-preview img.preview-img,
.asset-preview video.preview-video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    border-radius: 8px;
}

.asset-preview audio.preview-audio {
    width: 100%;
}

/* Improve overall row alignment and button layout */
.admin-list-item {
    min-height: 140px;
}

.admin-list-item input[type="checkbox"] {
    width: 22px;
    height: 22px;
    vertical-align: middle;
}

/* Make header checkbox match row checkboxes */
.admin-list-header .select-all-checkbox {
    width: 22px;
    height: 22px;
    vertical-align: middle;
}

.asset-info {
    vertical-align: middle;
}

/* Keep action buttons on the same grid cell, prevent wrapping */
.admin-list-item>.admin-btn {
    white-space: nowrap;
    vertical-align: middle;
    padding: 12px 16px;
    font-size: 1.08rem;
}

.admin-list-item>.admin-btn+.admin-btn {
    margin-left: 8px;
}

/* New: actions container on the right, keep buttons inline */
.asset-actions {
    display: flex;
    gap: 22px;
    align-items: center;
    justify-content: center;
    /* center the buttons horizontally */
    flex-wrap: nowrap;
    /* keep them on one row */
}

/* Tasteful action buttons: pill-shaped, subtle gradient, hover lift, and clearer spacing */
.asset-actions .admin-btn {
    padding: 10px 18px;
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.55);
    transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
    font-weight: 700;
    font-size: 1.02rem;
    letter-spacing: 0.02em;
    display: inline-flex;
    /* ensure buttons don't expand to full width */
    align-items: center;
    justify-content: center;
    min-width: 96px;
}

.asset-actions .admin-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.65);
}

.asset-actions .admin-btn:active {
    transform: translateY(0);
}

/* Delete gets a subtle red accent, but keep same pill shape */
.asset-actions .admin-btn.delete-btn {
    background: linear-gradient(180deg, rgba(255, 60, 60, 0.04), rgba(255, 60, 60, 0.02));
    border: 1px solid rgba(255, 60, 60, 0.10);
    color: #ffb4b4;
}

/* Ensure gap-driven spacing is authoritative (override any earlier small margin rules) */
.asset-actions .admin-btn {
    margin-left: 0 !important;
}

.asset-name {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 1.2rem;
    font-weight: 600;
}

/* subtle row separator and hover
   To keep vertical separators continuous we avoid per-row outer borders
   and rounded corners that previously caused visual gaps. Rows are
   visually separated using a single horizontal top-border between items. */
.admin-list-item {
    /* keep spacing and layout but do not draw an outer border */
    border-radius: 0;
    border: none;
    background: transparent;
}

.admin-list-item+.admin-list-item {
    /* make the separator between data rows more visible */
    border-top: 1px solid rgba(255, 255, 255, 0.18);
}

.admin-list-item:hover {
    background: rgba(255, 255, 255, 0.01);
}

.asset-meta {
    margin-top: 6px;
    display: flex;
    gap: 8px;
    align-items: center;
    color: rgba(255, 255, 255, 0.7);
    font-size: 1.02rem;
}

.asset-kind {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.03);
    color: #fff;
    font-weight: 600;
    font-size: 1rem;
}

.asset-size {
    color: rgba(255, 255, 255, 0.6);
    font-size: 1.05rem;
}

/* Header styles to align with columns */
.admin-list-header {
    display: table-row;
    color: rgba(255, 255, 255, 0.95);
    font-weight: 700;
    font-size: 1.12rem;
    background: rgba(255, 255, 255, 0.003);
}

.admin-list-header>div {
    display: table-cell;
    vertical-align: middle;
    padding: 28px 36px;
    text-align: center;
}

/* draw a single horizontal separator under the header so vertical borders continue */
.admin-list-header>div {
    border-bottom: 1px solid rgba(255, 255, 255, 0.20);
}

/* make each direct child of a row behave like a table-cell so borders align */
.admin-list-item>* {
    display: table-cell;
    vertical-align: middle;
    padding: 28px 36px;
}

/* column widths to match previous grid layout */
.admin-list-header>div:nth-child(1),
.admin-list-item>*:nth-child(1) {
    width: 36px;
}

.admin-list-header>div:nth-child(2),
.admin-list-item>*:nth-child(2) {
    width: 120px;
}

.admin-list-header>div:nth-child(3),
.admin-list-item>*:nth-child(3) {
    width: auto;
}

.admin-list-header>div:nth-child(4),
.admin-list-item>*:nth-child(4) {
    width: 120px;
}

.admin-list-header>div:nth-child(5),
.admin-list-item>*:nth-child(5) {
    width: 100px;
}

.admin-list-header>div:nth-child(6),
.admin-list-item>*:nth-child(6) {
    width: 160px;
}

.header-actions {
    text-align: right;
}

.header-preview,
.header-name,
.header-kind,
.header-size {
    padding-left: 4px;
}

/* vertical separators between columns for both header and rows */
/* Apply vertical separators only to the textual/data columns so lines align cleanly */
.admin-list-header>div:nth-child(2),
.admin-list-item>*:nth-child(2),
.admin-list-header>div:nth-child(3),
.admin-list-item>*:nth-child(3),
.admin-list-header>div:nth-child(4),
.admin-list-item>*:nth-child(4),
.admin-list-header>div:nth-child(5),
.admin-list-item>*:nth-child(5),
.admin-list-header>div:nth-child(6),
.admin-list-item>*:nth-child(6) {
    border-left: 1px solid rgba(255, 255, 255, 0.26);
    padding-left: 12px;
    /* header cells centered but keep data left-aligned for readability */
}

/* ensure the first column (checkbox) has small left padding and no left border */
.admin-list-header>div:nth-child(1),
.admin-list-item>*:nth-child(1) {
    padding-left: 12px;
}

/* center the checkbox column content */
.admin-list-header>div:nth-child(1),
.admin-list-item>*:nth-child(1) {
    text-align: center;
}

/* make checkbox cells horizontally and vertically centered */
.admin-list-header>div:nth-child(1),
.admin-list-item>*:nth-child(1) {
    /* ensure this column behaves as a table-cell and centers its content */
    display: table-cell;
    text-align: center;
    vertical-align: middle;
    padding: 10px 8px;
}

.admin-list-item input[type="checkbox"],
.admin-list-header .select-all-checkbox {
    /* make the checkbox a block-level element and center it within the table-cell */
    display: block;
    margin: 0 auto;
    vertical-align: middle;
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

/* Improved modal layout for sync direction dialog */
.modal-content h3 {
    margin: 0 0 8px 0;
    font-size: 1.25rem;
    font-weight: 800;
}

.modal-content p {
    margin: 0 0 16px 0;
    color: rgba(255, 255, 255, 0.85);
    line-height: 1.45;
}

.modal-actions {
    display: flex;
    gap: 12px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    margin-top: 10px;
}

.modal-actions .admin-btn {
    padding: 10px 18px;
    border-radius: 999px;
    min-width: 160px;
    font-weight: 700;
    font-size: 0.98rem;
    letter-spacing: 0.02em;
    /* unified secondary color for all buttons */
    background: linear-gradient(180deg, rgba(110, 120, 140, 0.10), rgba(80, 90, 110, 0.04));
    border: 1px solid rgba(110, 120, 140, 0.14);
    color: #e9eef8;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
    transition: transform .12s ease, box-shadow .12s ease;
}

.modal-actions .admin-btn:hover {
    transform: translateY(-3px);
    box-shadow: 0 12px 30px rgba(0, 0, 0, 0.62);
}

.modal-actions .admin-btn.sync-btn,
.modal-actions .admin-btn.delete-btn {
    /* same secondary appearance (no separate primary style) */
    background: linear-gradient(180deg, rgba(110, 120, 140, 0.10), rgba(80, 90, 110, 0.04));
    border: 1px solid rgba(110, 120, 140, 0.14);
    color: #e9eef8;
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.55);
}

/* Responsive: stack actions on narrow viewports */
@media (max-width: 480px) {
    .modal-content {
        padding: 18px;
    }

    .modal-actions {
        flex-direction: column;
    }

    .modal-actions .admin-btn {
        width: 100%;
        min-width: unset;
    }
}
</style>
