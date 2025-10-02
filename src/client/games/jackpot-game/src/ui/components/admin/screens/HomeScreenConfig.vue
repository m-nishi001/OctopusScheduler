<template>
    <div class="screen-config">
        <h3>ホーム画面設定</h3>
        <div class="config-item">
            <label>BGM:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="localConfig.bgmMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="localConfig.bgmMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="localConfig.bgmMode === 'select'" v-model="localConfig.bgmAssetId" class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
            </select>
            <input v-if="localConfig.bgmMode === 'upload'" type="file" @change="onBgmChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>ボタン押下SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="localConfig.buttonSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="localConfig.buttonSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="localConfig.buttonSeMode === 'select'" v-model="localConfig.buttonSeAssetId"
                class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
            </select>
            <input v-if="localConfig.buttonSeMode === 'upload'" type="file" @change="onButtonSeChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>プログレスバー完了SE:</label>
            <div class="asset-mode">
                <label><input type="radio" v-model="localConfig.progressSeMode" value="select" /> 既存から選択</label>
                <label><input type="radio" v-model="localConfig.progressSeMode" value="upload" /> アップロード</label>
            </div>
            <select v-if="localConfig.progressSeMode === 'select'" v-model="localConfig.progressSeAssetId"
                class="admin-input">
                <option value="">選択なし</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
            </select>
            <input v-if="localConfig.progressSeMode === 'upload'" type="file" @change="onProgressSeChange"
                accept="audio/*" class="admin-input" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch } from 'vue';

const props = defineProps<{
    audioAssets: any[];
    config: any;
}>();

const emit = defineEmits<{
    update: [config: any];
}>();

const localConfig = ref({ ...props.config });

watch(() => props.config, (newConfig) => {
    localConfig.value = { ...newConfig };
}, { deep: true });

const onBgmChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            localConfig.value.bgmAssetId = ev.target?.result as string;
            emit('update', localConfig.value);
        };
        reader.readAsDataURL(file);
    }
};

const onButtonSeChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            localConfig.value.buttonSeAssetId = ev.target?.result as string;
            emit('update', localConfig.value);
        };
        reader.readAsDataURL(file);
    }
};

const onProgressSeChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            localConfig.value.progressSeAssetId = ev.target?.result as string;
            emit('update', localConfig.value);
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