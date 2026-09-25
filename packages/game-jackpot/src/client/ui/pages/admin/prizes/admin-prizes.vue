<template>
    <div class="admin-section">
        <h2>景品設定</h2>
        <div class="admin-actions">
            <button type="button" class="admin-btn icon-only add-icon" @click.prevent="openAddModal" title="Add prizes">
                <span class="emoji">➕</span>
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

        <PrizeList :prizes="prizes" v-model:selected="selectedPrizes" v-model:is-all-selected="isAllSelected"
            :object-url-map="objectUrlMap" @edit="editPrize" @delete="deletePrize" />

        <PrizeAddDialog v-if="showAddModal" :show="showAddModal" :image-assets="imageAssets" :audio-assets="audioAssets"
            :other-prizes="prizes" @close="showAddModal = false" @refresh="fetchPrizes" />
        <PrizeEditDialog v-if="editPrizeData" :show="!!editPrizeData" :prize="editPrizeData" :image-assets="imageAssets"
            :audio-assets="audioAssets" :object-url-map="objectUrlMap" :other-prizes="prizes"
            @close="editPrizeData = null" @refresh="fetchPrizes" />

        <PrizeDeleteDialog v-if="showDeleteModal || deleting" :deleting="deleting" :delete-message="deleteMessage"
            @confirm="confirmDeleteSelected" @cancel="closeDeleteModal" />

        <DataUploadDialog v-if="showDataUploadDialog" :show="showDataUploadDialog" type="prize"
            @close="showDataUploadDialog = false" @refresh="fetchPrizes" />
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { usePrizes } from './use-prizes';
import { useAssets } from './use-assets';
import { AssetDataService } from '@control/asset/asset-data-service';
import { PrizeService } from '@control/prize/prize-service';
import { PrizeRepository } from '@model/prize/prize-repository';

import { container } from 'tsyringe';
const prizeRepo = container.resolve(PrizeRepository);
const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);
// initialize composables
const { prizes, selectedPrizes, isAllSelected, fetchPrizes: fetchPrizesInner, deletePrize: deletePrizeAction, deletePrizes: deletePrizesAction } = usePrizes(prizeRepo, prizeService);
const { imageAssets, audioAssets, fetchAssets: fetchAssetsAction, objectUrlMap, createObjectUrlById } = useAssets(assetDataService);

import PrizeAddDialog from './prize-add-dialog.vue';
import PrizeEditDialog from './prize-edit-dialog.vue';
import PrizeList from './components/prize-list.vue';
import PrizeDeleteDialog from './components/prize-delete-dialog.vue';
import DataUploadDialog from '../components/data-upload-dialog.vue';

const showAddModal = ref(false);
const openAddModal = () => { showAddModal.value = true; };

const showDeleteModal = ref(false);
const openDeleteModal = () => { showDeleteModal.value = true; };
const closeDeleteModal = () => { showDeleteModal.value = false; };

const deleting = ref(false);
const deleteMessage = ref("");

const fetchPrizes = async () => {
    await fetchPrizesInner();
    // create object urls for prize assets so the UI can display them
    for (const prize of prizes.value) {
        if (prize.imageAssetId) await createObjectUrlById(prize.imageAssetId);
        if (prize.image2AssetId) await createObjectUrlById(prize.image2AssetId);
        if (prize.winningImage1AssetId) await createObjectUrlById(prize.winningImage1AssetId);
        if (prize.winningImage2AssetId) await createObjectUrlById(prize.winningImage2AssetId);
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

const exportFormatCsv = () => {
    const csv = '名前,ランク,アニメーション,画像1ファイル名,画像2ファイル名,BGM1ファイル名,BGM2ファイル名,当選景品画像1ファイル名,当選景品画像2ファイル名,表示順\n';
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

onMounted(async () => {
    await fetchPrizes();
    await fetchAssets();
});

onBeforeUnmount(() => {
    try {
        for (const [, url] of objectUrlMap) {
            try { URL.revokeObjectURL(url); } catch { }
        }
        objectUrlMap.clear();
    } catch { }
});

</script>

<style scoped>
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
</style>
