<template>
    <div class="screen-config">
        <h3>デモ抽選画面設定</h3>
        <div class="config-item">
            <label>当選者:</label>
            <select v-model="config.winnerMemberId" class="admin-input">
                <option value="">選択</option>
                <option v-for="member in members" :key="member.id" :value="member.id">{{ member.name }}</option>
            </select>
        </div>
        <div class="config-item">
            <label>当選景品:</label>
            <select v-model="config.winnerPrizeId" class="admin-input">
                <option value="">選択</option>
                <option v-for="prize in prizes" :key="prize.id" :value="prize.id">{{ prize.name }}</option>
            </select>
        </div>
        <div class="config-item">
            <label>BGM:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.bgmMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.bgmMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.bgmMode === 'select'" v-model="config.bgmAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.bgmMode === 'upload'" type="file" @change="onBgmChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.seMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.seMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.seMode === 'select'" v-model="config.seAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.seMode === 'upload'" type="file" @change="onSeChange" accept="audio/*"
                class="admin-input" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';
import { FileUtils } from '../../../../model/infrastructures/utils/file-utils';
import { AssetDto } from '../../../../model/applications/asset/dto/asset-dto';

const props = defineProps<{
    audioAssets: any[];
    members: any[];
    prizes: any[];
    assetService: any;
    config?: any;
}>();

const emit = defineEmits<{
    update: [config: any];
    tempAssets: [tempAssets: AssetDto[]];
}>();

const config = ref(props.config ? JSON.parse(JSON.stringify(props.config)) : {
    winnerMemberId: '',
    winnerPrizeId: '',
    bgmMode: 'select',
    bgmAssetId: '',
    seMode: 'select',
    seAssetId: '',
});
const tempAssets = ref<AssetDto[]>([]);

import { watch } from 'vue';
watch(() => props.config, (newCfg: any) => {
    config.value = newCfg ? JSON.parse(JSON.stringify(newCfg)) : { winnerMemberId: '', winnerPrizeId: '' };
}, { deep: true });

watch(config, (newVal: any) => {
    try {
        const normalizedProp = props.config ? JSON.parse(JSON.stringify(props.config)) : undefined;
        if (JSON.stringify(normalizedProp) !== JSON.stringify(newVal)) {
            emit('update', newVal);
        }
    } catch (e) {
        emit('update', newVal);
    }
}, { deep: true });

const onBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const tempId = 'temp_' + Date.now();
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: tempId,
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.bgmAssetId = tempId;
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const tempId = 'temp_' + Date.now();
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: tempId,
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.seAssetId = tempId;
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};
</script>

<style scoped>
.screen-config {
    margin-bottom: 24px;
}

.screen-config h3 {
    margin-bottom: 16px;
    color: #fff;
}

.config-item {
    margin-bottom: 24px;
}

.config-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #fff;
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 1rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    margin-bottom: 8px;
    width: 100%;
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

.asset-mode {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
}

.asset-mode label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
}
</style>