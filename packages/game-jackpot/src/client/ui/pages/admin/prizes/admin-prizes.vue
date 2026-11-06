<template>
    <div class="admin-section">
        <UiToolbar>
            <UiButton variant="primary" icon="add" @click.prevent="showAddModal = true">追加</UiButton>
            <UiButton v-if="selectedPrizes.length" variant="danger" icon="delete" :loading="deleting"
                @click="deleteSelected">選択を削除({{ selectedPrizes.length }})</UiButton>
            <TableIoToolbar :count="prizes.length" :on-export="prizeIo.onExport" media-label="素材も含める(ZIP)"
                @import="importOpen = true" />
        </UiToolbar>

        <PrizeList :prizes="prizes" v-model:selected="selectedPrizes" :url-of="mediaUrls.urlOf" @edit="editPrize"
            @delete="deleteOne" />

        <TableImportDialog v-model="importOpen" :on-preview="prizeIo.onPreviewImport" allow-replace
            media-label="素材フォルダ" media-hint="CSVの画像・BGMの列のファイル名と同じファイルが入ったフォルダ。ZIPなら不要です" />

        <PrizeAddDialog v-if="showAddModal" :show="showAddModal" :other-prizes="prizes" @close="showAddModal = false"
            @refresh="fetchPrizes" />
        <PrizeEditDialog v-if="editPrizeData" :show="!!editPrizeData" :prize="editPrizeData" :other-prizes="prizes"
            @close="editPrizeData = null" @refresh="fetchPrizes" />
    </div>
</template>

<script setup lang="ts">
import { TableImportDialog, TableIoToolbar, UiButton, UiToolbar, toast, useConfirm } from '@octopus/ui-kit';
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { container } from 'tsyringe';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { JackpotRepository } from '@model/jackpot-repository';
import type { Prize } from '@model/prize/prize';
import { PrizeService } from '@control/prize/prize-service';
import { prizeTableIo } from '@control/prize-table/prize-table-io';
import { useMediaUrls } from '@ui/composables/use-media-urls';
import { usePrizes } from './use-prizes';
import PrizeAddDialog from './prize-add-dialog.vue';
import PrizeEditDialog from './prize-edit-dialog.vue';
import PrizeList from './components/prize-list.vue';

const repo = container.resolve(JackpotRepository);
const { prizes, selectedPrizes, fetchPrizes: fetchPrizesInner, deletePrizes } = usePrizes(repo, container.resolve(PrizeService));
const mediaUrls = useMediaUrls(repo);
const { confirmDelete } = useConfirm();

const showAddModal = ref(false);
const importOpen = ref(false);
const deleting = ref(false);
const editPrizeData = ref<Prize | null>(null);
const editPrize = (prize: Prize) => {
    editPrizeData.value = prize;
};

const fetchPrizes = async () => {
    await fetchPrizesInner();
    // 一覧に出す画像(景品の画像・当選画像)のプレビューを読み直す
    await mediaUrls.load(prizes.value.flatMap((p) => [p.image, p.image2, p.winningImage1, p.winningImage2]));
};

// CSV の書き出し・取込。取り込んだら一覧を読み直す。
const prizeIo = prizeTableIo({
    repo,
    afterImport: fetchPrizes,
    warn: (message) => toast.error(message),
});

// 確認を待つ間に一覧が入れ替わっても別の景品を消さないよう、id で消す。複数でもレコードの書き込みは1回。
const deleteByIds = async (ids: string[], message: string) => {
    if (!(await confirmDelete(message))) return;
    deleting.value = true;
    try {
        await deletePrizes(ids);
        await fetchPrizes();
    } catch (e) {
        console.error('Failed to delete prizes', e);
        toast.error('削除に失敗しました');
    } finally {
        deleting.value = false;
    }
};
const deleteOne = (id: string) => deleteByIds([id], `「${prizes.value.find((p) => p.id === id)?.name ?? id}」を削除しますか?`);
const deleteSelected = () => deleteByIds([...selectedPrizes.value], `選択した${selectedPrizes.value.length}件の景品を削除しますか?`);

// 初めて開くブラウザでは、表示した後の背景同期でサーバーのデータが取り込まれる。取り込み完了時に一覧を読み直す
const reloadAfterSync = () => {
    void fetchPrizes();
};

onMounted(async () => {
    eventBus.on('syncPulled', reloadAfterSync);
    await fetchPrizes();
});

onBeforeUnmount(() => {
    eventBus.off('syncPulled', reloadAfterSync);
});
</script>
