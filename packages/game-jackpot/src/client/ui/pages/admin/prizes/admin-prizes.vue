<template>
    <div class="admin-section">
        <UiToolbar>
            <UiButton variant="primary" icon="add" @click.prevent="openAddModal">追加</UiButton>
            <UiButton variant="danger" icon="delete" :disabled="!selectedPrizes.length || deleting"
                @click="openDeleteModal">選択削除</UiButton>
            <UiButton icon="file" @click.prevent="exportFormatCsv">書式CSV</UiButton>
            <UiButton icon="upload" @click.prevent="openDataUploadDialog">データ取込</UiButton>
        </UiToolbar>

        <PrizeList :prizes="prizes" v-model:selected="selectedPrizes" :object-url-map="objectUrlMap"
            @edit="editPrize" @delete="deletePrize" />

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
import { UiButton, UiToolbar } from '@octopus/ui-kit';
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
const { prizes, selectedPrizes, fetchPrizes: fetchPrizesInner, deletePrize: deletePrizeAction, deletePrizes: deletePrizesAction } = usePrizes(prizeRepo, prizeService);
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
