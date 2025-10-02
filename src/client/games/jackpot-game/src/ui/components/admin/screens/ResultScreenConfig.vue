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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
            </select>
            <input v-if="config.fadeSeMode === 'upload'" type="file" @change="onFadeSeChange" accept="audio/*"
                class="admin-input" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';

defineProps<{
    audioAssets: any[];
}>();

const emit = defineEmits<{
    update: [config: any];
}>();

const config = ref({
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

const onBgmChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            config.value.bgmAssetId = ev.target?.result as string;
            emit('update', config.value);
        };
        reader.readAsDataURL(file);
    }
};

const onScrollSeChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            config.value.scrollSeAssetId = ev.target?.result as string;
            emit('update', config.value);
        };
        reader.readAsDataURL(file);
    }
};

const onHighSeChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            config.value.highSeAssetId = ev.target?.result as string;
            emit('update', config.value);
        };
        reader.readAsDataURL(file);
    }
};

const onLowSeChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            config.value.lowSeAssetId = ev.target?.result as string;
            emit('update', config.value);
        };
        reader.readAsDataURL(file);
    }
};

const onFadeSeChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            config.value.fadeSeAssetId = ev.target?.result as string;
            emit('update', config.value);
        };
        reader.readAsDataURL(file);
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