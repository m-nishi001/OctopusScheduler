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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
            </select>
            <input v-if="config.endSeMode === 'upload'" type="file" @change="onEndSeChange" accept="audio/*"
                class="admin-input" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';

const props = defineProps<{
    audioAssets: any[];
    assetService: any;
}>();

const emit = defineEmits<{
    update: [config: any];
}>();

const config = ref({
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

const onBgmChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.bgmAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload BGM:', error);
        }
    }
};

const onMemberSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.memberSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload member SE:', error);
        }
    }
};

const onPrizeStartSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.prizeStartSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload prize start SE:', error);
        }
    }
};

const onLotterySeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.lotterySeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload lottery SE:', error);
        }
    }
};

const onConfirmSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.confirmSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload confirm SE:', error);
        }
    }
};

const onWinnerSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.winnerSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload winner SE:', error);
        }
    }
};

const onNextSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.nextSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload next SE:', error);
        }
    }
};

const onHalfSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.halfSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload half SE:', error);
        }
    }
};

const onEndSeChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.endSeAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload end SE:', error);
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