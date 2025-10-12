<template>
    <div class="screen-config">
        <h3>本抽選画面設定</h3>
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
            <label>メンバー選出SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.memberSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.memberSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.memberSeMode === 'select'" v-model="config.memberSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.memberSeMode === 'upload'" type="file" @change="onMemberSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>景品抽選開始SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.prizeStartSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.prizeStartSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.prizeStartSeMode === 'select'" v-model="config.prizeStartSeAssetId"
                class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.prizeStartSeMode === 'upload'" type="file" @change="onPrizeStartSeChange"
                accept="audio/*" class="admin-input" />
        </div>
        <div class="config-item">
            <label>抽選演出SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.lotterySeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.lotterySeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.lotterySeMode === 'select'" v-model="config.lotterySeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.lotterySeMode === 'upload'" type="file" @change="onLotterySeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>抽選確定SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.confirmSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.confirmSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.confirmSeMode === 'select'" v-model="config.confirmSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.confirmSeMode === 'upload'" type="file" @change="onConfirmSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>当選景品表示SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.winnerSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.winnerSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.winnerSeMode === 'select'" v-model="config.winnerSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.winnerSeMode === 'upload'" type="file" @change="onWinnerSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>「次の人を抽選します！」SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.nextSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.nextSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.nextSeMode === 'select'" v-model="config.nextSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.nextSeMode === 'upload'" type="file" @change="onNextSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>「残り半分です！」SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.halfSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.halfSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.halfSeMode === 'select'" v-model="config.halfSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.halfSeMode === 'upload'" type="file" @change="onHalfSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>抽選終了SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="config.endSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="config.endSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="config.endSeMode === 'select'" v-model="config.endSeAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="config.endSeMode === 'upload'" type="file" @change="onEndSeChange" accept="audio/*"
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
    memberSeMode: 'select',
    memberSeAssetId: '',
    prizeStartSeMode: 'select',
    prizeStartSeAssetId: '',
    lotterySeMode: 'select',
    lotterySeAssetId: '',
    confirmSeMode: 'select',
    confirmSeAssetId: '',
    winnerSeMode: 'select',
    winnerSeAssetId: '',
    nextSeMode: 'select',
    nextSeAssetId: '',
    halfSeMode: 'select',
    halfSeAssetId: '',
    endSeMode: 'select',
    endSeAssetId: '',
});
const tempAssets = ref<AssetDto[]>([]);

watch(() => props.config, (newCfg: any) => {
    config.value = newCfg ? JSON.parse(JSON.stringify(newCfg)) : {
        bgmMode: 'select',
        bgmAssetId: '',
        memberSeMode: 'select',
        memberSeAssetId: '',
        prizeStartSeMode: 'select',
        prizeStartSeAssetId: '',
        lotterySeMode: 'select',
        lotterySeAssetId: '',
        confirmSeMode: 'select',
        confirmSeAssetId: '',
        winnerSeMode: 'select',
        winnerSeAssetId: '',
        nextSeMode: 'select',
        nextSeAssetId: '',
        halfSeMode: 'select',
        halfSeAssetId: '',
        endSeMode: 'select',
        endSeAssetId: '',
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

const onMemberSeChange = async (e: Event) => {
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
            config.value.memberSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onPrizeStartSeChange = async (e: Event) => {
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
            config.value.prizeStartSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onLotterySeChange = async (e: Event) => {
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
            config.value.lotterySeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onConfirmSeChange = async (e: Event) => {
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
            config.value.confirmSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onWinnerSeChange = async (e: Event) => {
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
            config.value.winnerSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onNextSeChange = async (e: Event) => {
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
            config.value.nextSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onHalfSeChange = async (e: Event) => {
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
            config.value.halfSeAssetId = "";
            emit('update', config.value);
            emit('tempAssets', tempAssets.value);
        } catch (error) {
            console.error('Failed to create temp asset:', error);
        }
    }
};

const onEndSeChange = async (e: Event) => {
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
            config.value.endSeAssetId = "";
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