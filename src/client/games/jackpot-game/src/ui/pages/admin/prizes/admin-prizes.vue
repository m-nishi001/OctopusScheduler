<template>
    <div class="admin-section">
        <h2>景品設定</h2>
        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal" title="Add prizes">
                <span class="emoji">➕</span>
            </button>
            <button class="admin-btn icon-only sync-icon" @click.prevent="openPrizesSyncModal" title="Sync prizes"
                :disabled="syncing">
                <span class="emoji">🔄</span>
            </button>
            <button class="admin-btn icon-only delete-icon" @click="openDeleteModal"
                :disabled="!selectedPrizes.length || deleting" title="Delete selected">
                <span class="emoji">🗑️</span>
            </button>
            <button type="button" class="admin-btn icon-only export-icon" @click.prevent="exportFormatCsv"
                title="Export format CSV">
                <span class="emoji">📄</span>
            </button>
            <button type="button" class="admin-btn icon-only upload-icon" @click.prevent="openDataUploadDialog"
                title="Upload data">
                <span class="emoji">📤</span>
            </button>
        </div>

        <div v-if="prizes.length" class="list-controls">
            <label class="select-all-label">
                <input type="checkbox" v-model="isAllSelected" class="select-all-checkbox" />
                <span class="sr-only">全選択</span>
            </label>
        </div>

        <ul v-if="prizes.length" class="admin-list">
            <li v-for="prize in prizes" :key="prize.id" class="admin-list-item">
                <input type="checkbox" v-model="selectedPrizes" :value="prize.id" />
                <div class="prize-preview two-image">
                    <template v-if="prize.imageAssetId || prize.image2AssetId">
                        <div class="preview-half">
                            <img v-if="prize.imageAssetId"
                                :src="objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId" alt="image1"
                                class="preview-img" @error="onImageError" />
                            <div v-else class="preview-placeholder small">画像1なし</div>
                        </div>
                        <div class="preview-half">
                            <img v-if="prize.image2AssetId"
                                :src="objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId" alt="image2"
                                class="preview-img" @error="onImageError" />
                            <div v-else class="preview-placeholder small">画像2なし</div>
                        </div>
                    </template>
                    <template v-else>
                        <span>{{ prize.name }}</span>
                    </template>
                </div>
                <div class="prize-info">
                    <span>{{ prize.name }}</span>
                </div>
                <button class="admin-btn ml-2" @click="editPrize(prize)">詳細</button>
                <button class="admin-btn ml-2 delete-btn" @click="deletePrize(prize.id)">削除</button>
            </li>
        </ul>
        <div v-else class="empty-state">
            景品はありません
        </div>

        <PrizeAddDialog v-if="showAddModal" :show="showAddModal" :image-assets="imageAssets" :audio-assets="audioAssets"
            @close="showAddModal = false" @refresh="fetchPrizes" />
        <PrizeEditDialog v-if="editPrizeData" :prize="editPrizeData" :image-assets="imageAssets"
            :audio-assets="audioAssets" :object-url-map="objectUrlMap" @close="editPrizeData = null"
            @refresh="fetchPrizes" />

        <div v-if="showDeleteModal" class="modal-overlay">
            <div class="modal-content">
                <h3>景品を削除</h3>
                <p>選択した景品を削除しますか？</p>
                <div class="modal-actions">
                    <button class="admin-btn delete-btn" @click="confirmDeleteSelected">削除</button>
                    <button class="admin-btn" @click="closeDeleteModal">キャンセル</button>
                </div>
            </div>
        </div>

        <div v-if="deleting" class="modal-overlay">
            <div class="modal-content">
                <h3>削除中...</h3>
                <p>{{ deleteMessage }}</p>
                <div class="spinner"></div>
            </div>
        </div>

        <div v-if="syncing" class="modal-overlay">
            <div class="modal-content">
                <h3>サーバーと同期中...</h3>
                <p>{{ syncMessage || "景品を同期しています。しばらくお待ちください。" }}</p>
                <div class="spinner"></div>
            </div>
        </div>

        <div v-if="showSyncModeModal" class="modal-overlay">
            <div class="modal-content">
                <h3>同期モードを選択</h3>
                <p>同期時にどちらを正としますか？</p>
                <div class="modal-actions">
                    <button class="admin-btn" @click.prevent="confirmPrizesSyncMode('local')">ローカル優先 (Local
                        wins)</button>
                    <button class="admin-btn sync-btn" @click.prevent="confirmPrizesSyncMode('drive')">Drive優先 (Drive
                        wins)</button>
                    <button class="admin-btn delete-btn" @click.prevent="showSyncModeModal = false">キャンセル</button>
                </div>
            </div>
        </div>

        <div v-if="showReplaceWarningModal" class="modal-overlay">
            <div class="modal-content">
                <h3>注意: ローカルデータを置換します</h3>
                <p>Drive のコンテンツに合わせてローカルの景品を置換します。既存のローカルデータは削除されます。続行しますか？</p>
                <div class="modal-actions">
                    <button class="admin-btn delete-btn" @click.prevent="showReplaceWarningModal = false">キャンセル</button>
                    <button class="admin-btn sync-btn" @click.prevent="performReplaceFromDrive">置換して同期する</button>
                </div>
            </div>
        </div>

        <DataUploadDialog v-if="showDataUploadDialog" :show="showDataUploadDialog" type="prize"
            @close="showDataUploadDialog = false" @refresh="fetchPrizes" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { usePrizes } from './use-prizes';
import { useAssets } from './use-assets';
import { usePrizeSync } from './use-prize-sync';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import type { IPrizeRepository } from '@model/domains/prize/repository/i-prize-repository';

import { container } from 'tsyringe';
import { IPrizeRepositoryToken } from '@model/domains/prize/repository/i-prize-repository';
const prizeRepo = container.resolve<IPrizeRepository>(IPrizeRepositoryToken);
const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);
// initialize composables
const { prizes, selectedPrizes, isAllSelected, fetchPrizes: fetchPrizesInner, deletePrize: deletePrizeAction, deletePrizes: deletePrizesAction } = usePrizes(prizeRepo, prizeService);
const { imageAssets, audioAssets, fetchAssets: fetchAssetsAction, objectUrlMap, createObjectUrlById } = useAssets(assetDataService);
const { syncing: syncingState, syncMessage: syncMessageState, showSyncModeModal: showSyncModeModalState, showReplaceWarningModal: showReplaceWarningModalState, confirmPrizesSyncMode: confirmPrizesSyncModeAction, performReplaceFromDrive: performReplaceFromDriveAction } = usePrizeSync(prizeRepo, assetDataService, prizeService);

import PrizeAddDialog from './prize-add-dialog.vue';
import PrizeEditDialog from './prize-edit-dialog.vue';
import DataUploadDialog from '../components/data-upload-dialog.vue';

// prize and asset state are provided by composables: usePrizes and useAssets

const onImageError = (event: Event) => {
    const img = event.target as HTMLImageElement;
    img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiBmaWxsPSIjNTU1Ii8+Cjx0ZXh0IHg9IjUwIiB5PSI1MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEyIiBmaWxsPSIjY2NjIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4=';
    img.alt = 'No Image';
};

// `isAllSelected` is already provided by usePrizes composable

const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };

const showDeleteModal = ref(false);
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; };

// adding state is managed in Add/Edit dialogs; keep a var for potential top-level operations
const deleting = ref(false);
const deleteMessage = ref("");
const syncing = syncingState;
const syncMessage = syncMessageState;

const fetchPrizes = async () => {
    await fetchPrizesInner();
    // create object urls for prize assets so the UI can display them
    for (const prize of prizes.value) {
        if (prize.imageAssetId) await createObjectUrlById(prize.imageAssetId);
        if (prize.image2AssetId) await createObjectUrlById(prize.image2AssetId);
    }
};

const fetchAssets = async () => { await fetchAssetsAction(); };

const deletePrize = async (id: string) => {
    deleting.value = true;
    deleteMessage.value = "景品を削除しています...";
    try {
        await deletePrizeAction(id);
        await fetchPrizes();
    } catch (e) {
        console.error('Failed to delete prize', e);
    } finally {
        deleting.value = false;
    }
};

const deleteSelectedPrizes = async () => {
    if (!selectedPrizes.value.length) return;
    deleting.value = true;
    deleteMessage.value = "景品を削除しています...";
    try {
        await deletePrizesAction(selectedPrizes.value);
        await fetchPrizes();
        selectedPrizes.value = [];
    } catch (e) {
        console.error('Failed to delete prizes', e);
    } finally {
        deleting.value = false;
    }
};

const confirmDeleteSelected = async () => { await deleteSelectedPrizes(); closeDeleteModal(); };

const openPrizesSyncModal = () => {
    showSyncModeModal.value = true;
};

// downloadPrizesJsonFromDrive is provided by usePrizeSync/use-prize-sync if needed.

const exportFormatCsv = () => {
    const csv = '名前,ランク,アニメーション,画像1ファイル名,画像2ファイル名,BGM1ファイル名,BGM2ファイル名\n';
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'prizes_format.csv';
    a.click();
    URL.revokeObjectURL(url);
};

const showDataUploadDialog = ref(false);
const openDataUploadDialog = () => { showDataUploadDialog.value = true; };

const editPrizeData = ref<any>(null);
const editPrize = async (prize: any) => {
    editPrizeData.value = prize;
};

const showSyncModeModal = showSyncModeModalState;
const showReplaceWarningModal = showReplaceWarningModalState;

const confirmPrizesSyncMode = async (mode: "drive" | "local") => {
    await confirmPrizesSyncModeAction(mode, async () => {
        await fetchAssets();
        await fetchPrizes();
    });
};

const performReplaceFromDrive = async () => {
    await performReplaceFromDriveAction(fetchAssets, fetchPrizes);
};

onMounted(async () => {
    await fetchPrizes();
    await fetchAssets();
});

onBeforeUnmount(() => {
    try {
        objectUrlMap.forEach((url) => {
            try { URL.revokeObjectURL(url); } catch { }
        });
        objectUrlMap.clear();
    } catch { }
});

</script>

<style scoped>
/* All CSS from the legacy admin-prizes component was preserved and copied into the new file.
   This block comes from the previous `admin-prizes.vue`. */
.admin-section {
    margin-bottom: 28px;
}

.admin-actions {
    margin-bottom: 18px;
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
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
}

.select-all-label {
    margin-left: 10px;
}

.admin-list {
    list-style: none;
    padding: 0;
    margin: 0;
}

.admin-list-item {
    background: #232b36;
    color: #fff;
    padding: 14px;
    border-radius: 10px;
    margin-bottom: 12px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
    display: grid;
    grid-template-columns: 36px 110px 1fr auto auto;
    gap: 14px;
    align-items: center;
}

.admin-list-item input[type="checkbox"] {
    width: 20px;
    height: 20px;
    justify-self: center;
}

.prize-preview {
    width: 110px;
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2a3137;
    border-radius: 6px;
    overflow: hidden;
}

.prize-preview.two-image {
    display: flex;
    padding: 0;
}

.two-image .preview-half,
.two-image-preview .preview-half {
    width: 50%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: transparent;
}

.two-image .preview-half .preview-img,
.two-image-preview .preview-half .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.preview-placeholder.small {
    font-size: 0.82rem;
    color: #9fb8db;
    padding: 6px;
}

.preview-img {
    max-width: 100%;
    max-height: 100%;
    display: block;
}

.prize-info {
    min-width: 0;
}

.ml-2 {
    margin-left: 8px;
}

.empty-state {
    text-align: center;
    color: #c9d7e6;
    font-size: 1.1rem;
    padding: 40px;
}

.admin-input {
    padding: 12px 16px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    font-size: 0.96rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.2s ease;
}

.admin-input:focus {
    outline: none;
    border-color: #4f8cff;
    box-shadow: 0 0 0 3px rgba(79, 140, 255, 0.2);
    background: rgba(255, 255, 255, 0.08);
}

.admin-btn {
    padding: 12px 24px;
    border-radius: 12px;
    border: none;
    background: linear-gradient(135deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.3s ease;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 12px rgba(79, 140, 255, 0.2);
}

.admin-btn:hover {
    box-shadow: 0 8px 20px rgba(79, 140, 255, 0.3);
    transform: translateY(-2px);
}

.admin-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.delete-btn {
    background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%);
}

.delete-btn:hover {
    box-shadow: 0 6px 18px rgba(255, 107, 107, 0.14);
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

.sync-icon {

    border-radius: 8px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.01));
    color: #dbeeff;
}

.sync-icon .emoji {
    font-weight: 700;
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

.image-mode {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.image-mode label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
    cursor: pointer;
}

.bgm-mode {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: flex-start;
}

.bgm-mode label {
    color: #fff;
    font-weight: 500;
    cursor: pointer;
}

.bgm-radio-group {
    display: flex;
    gap: 16px;
    align-items: center;
}

.bgm-radio-group label {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.image-radio-group {
    display: flex;
    gap: 16px;
    align-items: center;
}

.image-radio-group label {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.left-col {
    grid-column: 1 / 2;
}

.image-file-input-wrap {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.image-file-input-wrap .admin-input[type="file"] {
    padding: 6px 10px;
    min-width: 140px;
}

.image-radio-group label {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.prize-input-group {
    display: flex;
    gap: 12px;
    align-items: center;
    flex-wrap: wrap;
}

.prize-name-input {
    flex: 1;
    min-width: 200px;
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
    padding: 24px;
}

.modal-overlay::-webkit-scrollbar {
    width: 0;
    height: 0;
}

.modal-content {
    background: linear-gradient(135deg, #232b36 0%, #2a3441 100%);
    color: #fff;
    padding: 28px;
    border-radius: 16px;
    text-align: left;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    max-width: 700px;
    width: 90%;
    border: 1px solid rgba(255, 255, 255, 0.1);
}

.modal-content.wide-modal {
    width: 75vw;
    max-width: none;
    flex: 0 0 75vw;
    margin: 0 auto;
    max-height: calc(100vh - 100px);
    height: auto;
    display: flex;
    flex-direction: column;
}

.add-modal-grid {
    display: grid;
    grid-template-columns: 1fr minmax(230px, 320px);
    gap: 20px;
    align-items: start;
    margin-top: 16px;
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    scrollbar-gutter: stable both-edges;
    --scrollbar-reserve: 16px;
    padding-right: var(--scrollbar-reserve);
    box-sizing: border-box;
}

.add-modal-grid {
    scrollbar-width: thin;
    -ms-overflow-style: auto;
}

.add-modal-grid,
.add-form-column,
.add-side-column {
    min-width: 0;
}

.modal-content.wide-modal {
    overflow-x: hidden;
}

.add-modal-grid::-webkit-scrollbar {
    width: 10px;
}

.add-modal-grid::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.06);
    border-radius: 6px;
}

.add-form-column .field-label {
    display: block;
    margin-bottom: 8px;
    color: #dbeeff;
    font-weight: 600;
    font-size: 0.95rem;
}

.field-block {
    margin-top: 12px;
}

.add-side-column {
    display: flex;
    flex-direction: column;
    gap: 16px;
    align-items: center;
    min-width: 0;
}

.add-form-column {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 12px 18px;
}

.add-form-column .span-2 {
    grid-column: 1 / -1;
}

.two-col {
    display: contents;
}

.buffer-column {
    display: flex;
    flex-direction: column;
    gap: 12px;
    justify-content: space-between;
}

.preview-box {
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1 / 1;
    background: linear-gradient(135deg, #2a3137 0%, #343d4a 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    z-index: 1000;
    border: 2px solid rgba(255, 255, 255, 0.1);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.preview-box .preview-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}

.preview-box.preview-box--small {
    max-width: 200px;
    aspect-ratio: 1 / 1;
}

.preview-box {
    pointer-events: none;
}

select.admin-input {
    background: rgba(255, 255, 255, 0.05);
    color: #fff;
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6,9 12,15 18,9'%3e%3c/polyline%3e%3c/svg%3e");
    background-repeat: no-repeat;
    background-position: right 12px center;
    background-size: 16px;
    padding-right: 40px;
    min-width: 200px;
}

select.admin-input:focus {
    background: rgba(255, 255, 255, 0.08);
}

select.admin-input option {
    background: #232b36;
    color: #fff;
    padding: 8px;
}

@media (max-width: 980px) {
    .add-modal-grid {
        grid-template-columns: 1fr;
    }

    .add-side-column {
        grid-column: 1 / -1;
        width: 100%;
        align-items: flex-start;
    }

    .preview-box {
        max-width: 100%;
        margin-top: 8px;
    }
}

.preview-placeholder {
    color: #9fb8db;
    font-size: 1.1rem;
    font-weight: 500;
}

.file-name {
    margin-top: 8px;
    color: #cfe8ff;
    font-size: 0.92rem;
}

.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    flex: 0 0 auto;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.footer-left {
    display: flex;
    gap: 8px;
    align-items: center;
}

.footer-right {
    display: flex;
    gap: 12px;
    align-items: center;
}

.admin-modal-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
    margin-top: 18px;
}

.cancel-primary {
    background: linear-gradient(135deg, #3b4650 0%, #4a5560 100%);
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.cancel-primary:hover {
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
    transform: translateY(-2px);
}

.modal-actions {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.admin-modal-buttons {
    display: flex;
    gap: 12px;
    align-items: center;
    justify-content: flex-end;
    margin-top: 18px;
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

.bgm-select-group {
    min-width: 240px;
    width: 100%;
}

.bgm-file-input-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
}

.bgm-file-input-wrap .admin-input[type="file"] {
    padding: 8px 12px;
    min-width: 200px;
}

.image-select-group {
    min-width: 240px;
    width: 100%;
}

.image-file-input-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    width: 100%;
}

.image-file-input-wrap .admin-input[type="file"] {
    padding: 8px 12px;
    min-width: 200px;
}
</style>
