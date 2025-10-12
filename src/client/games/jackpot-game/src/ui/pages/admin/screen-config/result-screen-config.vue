<template>
    <div class="screen-config">
        <h3>最終結果画面設定</h3>
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
            <label>結果リストスクロールSE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.scrollSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.scrollSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.scrollSeMode === 'select'" v-model="config.scrollSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.scrollSeMode === 'upload'" type="file" @change="onScrollSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>最高ランク景品当選者表示SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.highSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.highSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.highSeMode === 'select'" v-model="config.highSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.highSeMode === 'upload'" type="file" @change="onHighSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>最低ランク景品当選者表示SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.lowSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.lowSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.lowSeMode === 'select'" v-model="config.lowSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.lowSeMode === 'upload'" type="file" @change="onLowSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>黒画面フェードインSE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.fadeSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.fadeSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.fadeSeMode === 'select'" v-model="config.fadeSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.fadeSeMode === 'upload'" type="file" @change="onFadeSeChange" accept="audio/*"
                class="admin-input" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineEmits, watch } from 'vue';
import { FileUtils } from '../../../../model/infrastructures/utils/file-utils';
import { AssetDto } from '../../../../model/applications/asset/dto/asset-dto';

const props = defineProps<{
    audioAssets: any[];
    assetService: any;
    config?: any;
}>();

const emit = defineEmits<{
    update: [config: any];
    uploading: [isUploading: boolean];
    tempAssets: [tempAssets: AssetDto[]];
}>();

const config = ref(props.config ? JSON.parse(JSON.stringify(props.config)) : {
    bgmMode: 'select',
    bgmAssetId: '',
    scrollSeMode: 'select',
    scrollSeAssetId: '',
    highSeMode: 'select',
    highSeAssetId: '',
    lowSeMode: 'select',
    lowSeAssetId: '',
    fadeSeMode: 'select',
    fadeSeAssetId: '',
});
const tempAssets = ref<AssetDto[]>([]);

watch(() => props.config, (newCfg: any) => {
    config.value = newCfg ? JSON.parse(JSON.stringify(newCfg)) : {
        bgmMode: 'select',
        bgmAssetId: '',
        scrollSeMode: 'select',
        scrollSeAssetId: '',
        highSeMode: 'select',
        highSeAssetId: '',
        lowSeMode: 'select',
        lowSeAssetId: '',
        fadeSeMode: 'select',
        fadeSeAssetId: '',
    };
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
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.bgmAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onScrollSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.scrollSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onHighSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.highSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onLowSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.lowSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onFadeSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const dataUrl = await FileUtils.readAsDataUrl(file);
            const assetDto = new AssetDto({
                id: "",
                type: FileUtils.getAssetType(file.type),
                dataUrl,
                name: file.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: file.size,
            });
            tempAssets.value.push(assetDto);
            config.value.fadeSeAssetId = "";
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

/* Prevent inputs and flex children from causing horizontal overflow */
.admin-input {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.asset-mode {
    flex-wrap: wrap;
}

.config-item {
    min-width: 0;
}
</style>