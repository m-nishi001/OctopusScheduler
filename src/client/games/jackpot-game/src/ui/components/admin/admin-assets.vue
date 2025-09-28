<template>
    <div class="admin-section">
        <h2>アセット管理</h2>
        <form class="admin-form" @submit.prevent="addAsset">
            <input v-model="assetName" type="text" placeholder="アセット名" class="admin-input" />
            <select v-model="assetType" class="admin-input">
                <option value="image">画像</option>
                <option value="audio">音声</option>
                <option value="video">動画</option>
            </select>
            <input type="file" @change="onFileChange" accept="image/*,audio/*,video/*" class="admin-input" />
            <button type="submit" class="admin-btn">追加</button>
        </form>
        <ul class="admin-list">
            <li v-for="asset in assets" :key="asset.id" class="admin-list-item">
                <span>{{ asset.name }} ({{ asset.type }})</span>
                <button class="admin-btn ml-2" @click="deleteAsset(asset.id)">削除</button>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AssetService } from '../../../model/applications/asset-service';

import { container } from 'tsyringe';
const assetService = container.resolve(AssetService);
const assets = ref<any[]>([]);
const assetName = ref('');
const assetType = ref('image');
const selectedFile = ref<File | null>(null);

const fetchAssets = async () => {
    assets.value = await assetService.fetchAssets();
};

const onFileChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        selectedFile.value = file;
    }
};

const addAsset = async () => {
    if (!assetName.value || !selectedFile.value) return;
    const asset = {
        id: String(Date.now()),
        name: assetName.value,
        type: assetType.value as 'image' | 'audio' | 'video',
        url: '',
        uploadedAt: new Date().toISOString(),
        size: selectedFile.value.size,
    };
    await assetService.addAsset(asset);
    fetchAssets();
    assetName.value = '';
    selectedFile.value = null;
};

const deleteAsset = async (id: string) => {
    await assetService.deleteAsset(id);
    fetchAssets();
};

onMounted(() => {
    fetchAssets();
});
</script>

<style scoped>
.admin-section {
    margin-bottom: 32px;
}

.admin-form {
    display: flex;
    gap: 16px;
    margin-bottom: 24px;
    flex-wrap: wrap;
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 1rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

.admin-btn {
    padding: 10px 24px;
    border-radius: 8px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: bold;
    cursor: pointer;
    transition: background 0.2s;
}

.admin-btn:hover {
    background: linear-gradient(90deg, #aee1ff 0%, #4f8cff 100%);
}

.admin-list {
    list-style: none;
    padding: 0;
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
}

.admin-list-item {
    background: #232b36;
    color: #fff;
    padding: 10px 16px;
    border-radius: 8px;
    margin-bottom: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}
</style>