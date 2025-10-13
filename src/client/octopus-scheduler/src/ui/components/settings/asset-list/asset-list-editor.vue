<template>
    <div class="asset-list-editor">
        <div class="editor-content">
            <h2 class="editor-title">
                <span class="editor-icon">🗂️</span> アセット管理
            </h2>
            <div class="controls">
                <label>
                    種別:
                    <select v-model="selectedType">
                        <option value="audio">Audio</option>
                        <option value="image">Image</option>
                        <option value="video">Video</option>
                    </select>
                </label>
                <button class="main-btn" @click="onSync" :disabled="syncing">
                    <span class="btn-icon">🔄</span> 同期
                </button>
            </div>
            <div class="table-section">
                <table class="asset-table">
                    <thead>
                        <tr>
                            <th>名前</th>
                            <th>最終更新</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="asset in filteredAssets" :key="asset.id">
                            <td>{{ asset.name }}</td>
                            <td>{{ formatDate(asset.lastUpdated) }}</td>
                            <td>
                                <button class="main-btn small" @click="onPreview(asset)"><span
                                        class="btn-icon">👁️</span> プレビュー</button>
                                <button class="main-btn small" @click="onDelete(asset)"><span
                                        class="btn-icon">🗑️</span> 削除</button>
                            </td>
                        </tr>
                        <tr v-if="filteredAssets.length === 0">
                            <td colspan="3">アセットが見つかりません。</td>
                        </tr>
                    </tbody>
                </table>
            </div>
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
                    <button class="main-btn" @click="onAdd" :disabled="adding">
                        <span class="btn-icon">➕</span> 追加
                    </button>
                </div>
            </div>
            <!-- プレビューモーダル -->
            <AssetPreviewModal v-if="previewAsset" @close="closePreview">
                <template v-if="previewAssetType === 'audio'">
                    <div style="text-align:center;">
                        <h3>音楽プレビュー: {{ previewAsset.assetName }}</h3>
                        <AudioPreview :asset="previewAsset" />
                    </div>
                </template>
                <template v-else-if="previewAssetType === 'image'">
                    <ImagePreview :src="getAssetUrl(previewAsset)" :name="previewAsset.assetName" />
                </template>
                <template v-else-if="previewAssetType === 'video'">
                    <VideoPreview :src="getAssetUrl(previewAsset)" :name="previewAsset.assetName" />
                </template>
            </AssetPreviewModal>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import AssetPreviewModal from './AssetPreviewModal.vue';
import AudioPreview from './AudioPreview.vue';
import ImagePreview from './ImagePreview.vue';
import VideoPreview from './VideoPreview.vue';
import { AssetService } from '../../../../model/applications/assets/asset-service';
import type { Asset } from '../../../../model/domains/assets/entity/asset';
import { container } from "tsyringe";

type AssetTypeName = 'audio' | 'image' | 'video';

const selectedType = ref<AssetTypeName>('audio');
const assets = ref<any[]>([]);
const newName = ref('');
const newFile = ref<File | null>(null);
const adding = ref(false);
const syncing = ref(false);

// プレビュー用状態
const previewAsset = ref<any>(null);
const previewAssetType = ref<AssetTypeName | null>(null);

function getAssetUrl(asset: Asset | null): string {
    return asset?.dataUrl || '';
}

function onPreview(asset: any) {
    // typeの判定
    const type = asset.type;
    if (type?.includes('audio')) previewAssetType.value = 'audio';
    else if (type?.includes('image')) previewAssetType.value = 'image';
    else if (type?.includes('video')) previewAssetType.value = 'video';
    else previewAssetType.value = null;
    previewAsset.value = asset;
}

function closePreview() {
    previewAsset.value = null;
    previewAssetType.value = null;
}

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
    return assets.value.filter(a => (a.type ?? '').includes(selectedType.value) === true);
});

async function loadAssets() {
    try {
        const list = await service.getAssets();
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

async function onAdd() {
    if (!newName.value) { alert('名前を入力してください'); return; }
    if (!newFile.value) { alert('ファイルを選択してください'); return; }
    adding.value = true;
    try {
        const buf = await newFile.value.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
        const dataUrl = `data:${newFile.value.type};base64,${base64}`;

        const asset: Asset = {
            id: crypto.randomUUID(),
            type: selectedType.value,
            dataUrl,
            name: newName.value,
            uploadedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            size: buf.byteLength,
            referenceFrom: []
        };

        await service.addAssets([asset]);
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

async function onDelete(asset: any) {
    if (!window.confirm(`${asset.name} を削除しますか？`)) return;
    try {
        await service.deleteAssets([asset.id]);
        await loadAssets();
    } catch (e) {
        console.error('Delete failed', e);
        alert('削除に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}
</script>

<style scoped>
.asset-list-editor {
    color: #fff;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
}

.editor-content {
    width: 100%;
    height: 100%;
    padding: 2em;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
}

.nav-group {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 1em;
}

.nav-btn {
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    font-size: 1em;
    font-weight: 600;
    padding: 0.7em 1.8em;
    margin-right: 1em;
    display: flex;
    align-items: center;
    gap: 0.7em;
}

.editor-title {
    font-size: 2em;
    font-weight: 700;
    letter-spacing: 0.04em;
    margin-bottom: 2em;
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: #fff;
    text-shadow: 0 2px 12px #000a;
}

.editor-icon {
    font-size: 1.3em;
}

.controls {
    display: flex;
    gap: 1.2em;
    align-items: center;
    margin-bottom: 1.5em;
    width: 100%;
    justify-content: center;
}

.main-btn {
    font-size: 1.05em;
    font-weight: 600;
    padding: 0.8em 2em;
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
    outline: none;
    position: relative;
    display: flex;
    align-items: center;
    gap: 0.7em;
}

.main-btn .btn-icon {
    font-size: 1.2em;
}

.main-btn:hover,
.main-btn:focus {
    background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px) scale(1.04);
}

.main-btn:active {
    background: #1a1a1a;
    transform: scale(0.98);
}

.main-btn.small {
    font-size: 0.95em;
    padding: 0.5em 1.2em;
    margin-right: 0.5em;
}

.table-section {
    width: 100%;
    margin-bottom: 1.5em;
}

.asset-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 1rem;
    background: #232323;
    border-radius: 10px;
    overflow: hidden;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
}

.asset-table th,
.asset-table td {
    border: 1px solid #444;
    padding: 0.7rem;
    color: #fff;
}

.asset-table th {
    background: #222;
    font-weight: 600;
}

.asset-table tr {
    transition: background 0.15s;
}

.asset-table tr:hover {
    background: #2a2a2a;
}

.add-form {
    margin-top: 1.5em;
    width: 100%;
    background: #232323;
    border-radius: 10px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.18);
    padding: 1.2em 1em;
}

.add-form h3 {
    margin-bottom: 1em;
    color: #8fd3ff;
}

.add-form label {
    display: flex;
    align-items: center;
    gap: 0.7em;
    margin-bottom: 0.7em;
    color: #fff;
}

.add-form input[type="text"],
.add-form input[type="file"] {
    background: #333;
    color: #fff;
    border: 1px solid #666;
    padding: 0.4em 0.8em;
    border-radius: 6px;
}

@media (max-width: 600px) {
    .editor-content {
        width: 100vw;
        height: 100vh;
        padding: 0.5em;
    }

    .editor-title {
        font-size: 1.2em;
    }

    .main-btn {
        font-size: 0.95em;
        padding: 0.7em 1.2em;
    }

    .asset-table th,
    .asset-table td {
        padding: 0.4em;
    }

    .add-form {
        padding: 0.7em 0.3em;
    }
}
</style>
