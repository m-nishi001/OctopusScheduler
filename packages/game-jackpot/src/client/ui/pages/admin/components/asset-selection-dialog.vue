<template>
    <UiDialog :model-value="true" title="音楽を選択してください" size="md" nested :close-on-overlay="false" @close="$emit('close')">
        <div class="asset-list">
            <label class="asset-row" v-for="asset in assets" :key="asset.id">
                <input type="checkbox" :value="asset.id" v-model="selected" />
                <span class="asset-name">{{ asset.name }}</span>
            </label>
        </div>
        <input type="file" accept="audio/*" ref="fileInput" @change="onUpload" />
        <template #footer>
            <UiButton variant="danger" @click="deleteSelected">削除</UiButton>
            <UiButton @click="chooseFromExplorer">エクスプローラーから選択</UiButton>
            <UiButton @click="$emit('close')">閉じる</UiButton>
            <UiButton variant="primary" @click="confirmSelection">選択</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '@control/asset/asset-data-service';
import type { Asset } from '@model/asset/asset-data';

defineProps<{ modelValue?: boolean }>();
const emit = defineEmits(['close', 'selected']);

const assetDataService = container.resolve(AssetDataService);
const assets = ref<Asset[]>([]);
const selected = ref<string[]>([]);
const fileInput = ref<HTMLInputElement | null>(null);

const load = async () => {


    const all = await assetDataService.getAllAssetData();
    assets.value = all.filter((a) => !!a?.type && a.type.startsWith('audio/'));
};

onMounted(() => { load(); });

const onUpload = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const dto = await assetDataService.createDriveDataDtoFromFile(file);
    await assetDataService.addAssetData([dto]);
    await load();
};

const deleteSelected = async () => {
    if (!selected.value.length) return;
    await assetDataService.deleteAssetData(selected.value);
    selected.value = [];
    await load();
};

const confirmSelection = () => {
    emit('selected', selected.value.slice());
    emit('close');
};

const chooseFromExplorer = () => {
    fileInput.value?.click();
};
</script>

<style scoped>
.asset-list {
    max-height: 240px;
    overflow: auto;
    border: 1px solid var(--ui-border, #3a4048);
    padding: 8px;
    margin: 12px 0
}

.asset-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px;
    border-bottom: 1px solid var(--ui-border, #3a4048)
}

.asset-name {
    flex: 1
}

.delete-btn {
    background: var(--ui-danger, #e5484d)
}
</style>
