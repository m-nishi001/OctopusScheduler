<template>
    <div class="asset-list-editor">
        <h2>アセット管理</h2>

        <div class="controls">
            <label>
                種別:
                <select v-model="selectedType">
                    <option value="audio">Audio</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                </select>
            </label>
            <button @click="onSync" :disabled="syncing">同期</button>
        </div>

        <table class="asset-table">
            <thead>
                <tr>
                    <th>名前</th>
                    <th>最終更新</th>
                    <th>操作</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="asset in filteredAssets" :key="asset.assetId">
                    <td>{{ asset.assetName }}</td>
                    <td>{{ formatDate(asset.updatedAt) }}</td>
                    <td>
                        <button @click="onRename(asset)">名前変更</button>
                        <button @click="onDelete(asset)">削除</button>
                    </td>
                </tr>
                <tr v-if="filteredAssets.length === 0">
                    <td colspan="3">アセットが見つかりません。</td>
                </tr>
            </tbody>
        </table>

        <div class="add-form">
            <h3>アセット追加</h3>
            <label>
                名前:
                <input v-model="newName" placeholder="アセット名" />
            </label>
            <label>
                ファイル:
                <input type="file" @change="onFileChange" />
            </label>
            <div style="margin-top:0.5em;">
                <button @click="onAdd" :disabled="adding">追加</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { AssetService } from '../../../model/applications/assets/asset-service';
import { Asset } from '../../../model/domains/assets/entity/assset';
import { AudioType } from '../../../model/domains/assets/vo/audio-asset-type';
import { ImageType } from '../../../model/domains/assets/vo/image-asset-type';
import { VideoType } from '../../../model/domains/assets/vo/video-asset-type';
import { container } from "tsyringe";

type AssetTypeName = 'audio' | 'image' | 'video';

const selectedType = ref<AssetTypeName>('audio');
const assets = ref<Asset[]>([]);
const newName = ref('');
const newFile = ref<File | null>(null);
const adding = ref(false);
const syncing = ref(false);

// use concrete repository + service from client infra
const service = container.resolve(AssetService);

function formatDate(d: any) {
    try {
        const date = new Date(d);
        return isNaN(date.getTime()) ? '' : date.toLocaleString();
    } catch {
        return '';
    }
}

const filteredAssets = computed(() => {
    console.log('Filtering assets by type:', selectedType.value);
    console.log('All assets:', assets.value);
    return assets.value.filter(a => (a.assetType?.assetTypeName ?? '').includes(selectedType.value) === true);
});

async function loadAssets() {
    try {
        const list = await service.getAllAssets();
        assets.value = list || [];
    } catch (e) {
        console.error('Failed to load assets', e);
        alert('アセット取得に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

onMounted(async () => {
    await loadAssets();
});

function onFileChange(e: Event) {
    const t = e.target as HTMLInputElement;
    if (t.files && t.files.length > 0) newFile.value = t.files[0];
}

function createTypeInstance(type: AssetTypeName) {
    switch (type) {
        case 'audio': return new AudioType();
        case 'image': return new ImageType();
        case 'video': return new VideoType();
    }
}

async function onAdd() {
    if (!newName.value) { alert('名前を入力してください'); return; }
    if (!newFile.value) { alert('ファイルを選択してください'); return; }
    adding.value = true;
    try {
        const buf = await newFile.value.arrayBuffer();
        const blob = new Blob([buf], { type: newFile.value.type || 'application/octet-stream' });

        const typeInst = createTypeInstance(selectedType.value);
        const asset = Asset.create(typeInst as any);
        asset.updateAssetName(newName.value);
        asset.updateAssetData(blob);

        await service.addAsset(asset);
        newName.value = '';
        newFile.value = null;
        await loadAssets();
    } catch (e) {
        console.error('Add failed', e);
        alert('追加に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        adding.value = false;
    }
}

async function onSync() {
    syncing.value = true;
    try {
        await service.syncAssets();
        await loadAssets();
        alert('同期完了');
    } catch (e) {
        console.error('Sync failed', e);
        alert('同期に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
        syncing.value = false;
    }
}

async function onRename(asset: any) {
    const newN = window.prompt('新しい名前を入力してください', asset.assetName);
    if (!newN || newN === asset.assetName) return;
    try {
        await service.updateAsset(asset.assetId, newN);
        await loadAssets();
    } catch (e) {
        console.error('Rename failed', e);
        alert('名前変更に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

async function onDelete(asset: any) {
    if (!window.confirm(`${asset.assetName} を削除しますか？`)) return;
    try {
        await service.deleteAsset(asset.assetId);
        await loadAssets();
    } catch (e) {
        console.error('Delete failed', e);
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}
</script>

<style scoped>
.controls {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
}

.asset-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
}

.asset-table th,
.asset-table td {
    border: 1px solid #ddd;
    padding: 0.5rem;
}

.add-form {
    margin-top: 1rem;
}
</style>
