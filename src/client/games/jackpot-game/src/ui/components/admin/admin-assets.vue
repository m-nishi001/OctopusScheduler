<template>
    <div class="admin-section">
        <h2>アセット管理</h2>
        <form class="admin-form" @submit.prevent="addAssets">
            <input type="file" @change="onFileChange" accept="image/*,audio/*,video/*" multiple class="admin-input" />
            <button type="submit" class="admin-btn" :disabled="!selectedFiles.length">追加</button>
        </form>
        <div class="admin-actions">
            <button class="admin-btn delete-btn" @click="deleteSelectedAssets"
                :disabled="!selectedAssets.length">選択したアセットを削除</button>
        </div>
        <ul class="admin-list">
            <li v-for="asset in assets" :key="asset.id" class="admin-list-item">
                <input type="checkbox" v-model="selectedAssets" :value="asset.id" />
                <div class="asset-preview">
                    <img v-if="asset.type === 'image' && asset.url" :src="asset.url" alt="preview"
                        class="preview-img" />
                    <video v-else-if="asset.type === 'video' && asset.url" :src="asset.url" controls
                        class="preview-video"></video>
                    <audio v-else-if="asset.type === 'audio' && asset.url" :src="asset.url" controls
                        class="preview-audio"></audio>
                    <span v-else>{{ asset.name }}</span>
                </div>
                <div class="asset-info">
                    <span>{{ asset.name }} ({{ asset.type }}) - {{ formatSize(asset.size) }}</span>
                    <div class="usage-info">
                        <strong>使用場所:</strong>
                        <ul>
                            <li v-for="usage in getUsage(asset.id)" :key="usage">{{ usage }}</li>
                        </ul>
                    </div>
                </div>
                <button class="admin-btn ml-2" @click="deleteAsset(asset.id)">削除</button>
            </li>
        </ul>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { AssetService } from '../../../model/applications/asset-service';
import { MemberService } from '../../../model/applications/member-service';
import { PrizeService } from '../../../model/applications/prize-service';
import { ScreenConfigService } from '../../../model/applications/screen-config-service';

import { container } from 'tsyringe';
const assetService = container.resolve(AssetService);
const memberService = container.resolve(MemberService);
const prizeService = container.resolve(PrizeService);
const screenConfigService = container.resolve(ScreenConfigService);

const assets = ref<any[]>([]);
const selectedFiles = ref<File[]>([]);
const selectedAssets = ref<string[]>([]);

const members = ref<any[]>([]);
const prizes = ref<any[]>([]);
const screenConfigs = ref<any[]>([]);

const fetchAssets = async () => {
    assets.value = await assetService.fetchAssets();
};

const fetchUsageData = async () => {
    members.value = await memberService.fetchMembers();
    prizes.value = await prizeService.fetchPrizes();
    const screenTypes = ['home', 'opening', 'description', 'demo', 'main', 'result', 'admin'];
    screenConfigs.value = await Promise.all(screenTypes.map(type => screenConfigService.fetchScreenConfig(type)));
};

const onFileChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        selectedFiles.value = Array.from(files);
    }
};

const addAssets = async () => {
    if (!selectedFiles.value.length) return;
    await assetService.addAssets(selectedFiles.value);
    fetchAssets();
    selectedFiles.value = [];
};

const deleteAsset = async (id: string) => {
    await assetService.deleteAsset(id);
    fetchAssets();
};

const deleteSelectedAssets = async () => {
    const promises = selectedAssets.value.map(id => assetService.deleteAsset(id));
    await Promise.all(promises);
    selectedAssets.value = [];
    fetchAssets();
};

const getUsage = (assetId: string) => {
    const usages: string[] = [];
    // Members
    members.value.forEach(member => {
        if (member.photoAssetId === assetId) {
            usages.push(`メンバー: ${member.name}`);
        }
    });
    // Prizes
    prizes.value.forEach(prize => {
        if (prize.imageAssetId === assetId) {
            usages.push(`景品: ${prize.name} (画像)`);
        }
        if (prize.bgm1AssetId === assetId) {
            usages.push(`景品: ${prize.name} (BGM1)`);
        }
        if (prize.bgm2AssetId === assetId) {
            usages.push(`景品: ${prize.name} (BGM2)`);
        }
    });
    // ScreenConfigs
    screenConfigs.value.forEach(config => {
        if (config.bgmAssetId === assetId) {
            usages.push(`画面設定: ${config.type} (BGM)`);
        }
        if (config.seAssetIds && config.seAssetIds.includes(assetId)) {
            usages.push(`画面設定: ${config.type} (SE)`);
        }
        config.elements.forEach((element: any) => {
            if (element.assetId === assetId) {
                usages.push(`画面設定: ${config.type} (要素: ${element.type})`);
            }
        });
    });
    return usages;
};

const formatSize = (size: number) => {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / (1024 * 1024)).toFixed(1)} MB`;
};

onMounted(async () => {
    await fetchAssets();
    await fetchUsageData();
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

.admin-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.delete-btn {
    background: linear-gradient(90deg, #ff4f4f 0%, #ffaeae 100%);
}

.delete-btn:hover {
    background: linear-gradient(90deg, #ffaeae 0%, #ff4f4f 100%);
}

.admin-actions {
    margin-bottom: 16px;
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
    padding: 16px;
    border-radius: 8px;
    margin-bottom: 8px;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
}

.asset-preview {
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #333;
    border-radius: 4px;
}

.preview-img {
    max-width: 100%;
    max-height: 100%;
    border-radius: 4px;
}

.preview-video,
.preview-audio {
    max-width: 100%;
    max-height: 100%;
}

.asset-info {
    flex: 1;
}

.usage-info ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0 0;
}

.usage-info li {
    font-size: 0.9em;
    color: #ccc;
}

.ml-2 {
    margin-left: 8px;
}
</style>