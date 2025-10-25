<template>
    <div class="asset-dialog-overlay">
        <div class="asset-dialog" @click.stop>
            <h3>音楽を選択してください</h3>
            <div class="asset-list">
                <label class="asset-row" v-for="asset in assets" :key="asset.id">
                    <input type="checkbox" :value="asset.id" v-model="selected" />
                    <span class="asset-name">{{ asset.name }}</span>
                </label>
            </div>
            <div class="asset-actions">
                
                <input type="file" accept="audio/*" ref="fileInput" @change="onUpload" />
                <div class="btn-row">
                    <button class="admin-btn" @click="chooseFromExplorer">エクスプローラーから選択</button>
                    <button class="admin-btn" @click="confirmSelection">選択</button>
                    <button class="admin-btn delete-btn" @click="deleteSelected">削除</button>
                    <button class="admin-btn cancel-primary" @click="$emit('close')">閉じる</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { AssetDataService } from '../../../../model/applications/asset/asset-data-service';
import type { Asset } from '../../../../model/domains/drive-data/asset-data';

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
.asset-dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1200
}

.asset-dialog {
    background: #232b36;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    width: 420px
}

.asset-list {
    max-height: 240px;
    overflow: auto;
    border: 1px solid #444;
    padding: 8px;
    margin: 12px 0
}

.asset-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.03)
}

.asset-name {
    flex: 1
}

.btn-row {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 8px
}

.admin-btn {
    padding: 6px 10px;
    border-radius: 6px
}

.delete-btn {
    background: linear-gradient(90deg, #ff6b6b 0%, #ffb3b3 100%)
}

.cancel-primary {
    background: #3b4650
}
</style>
