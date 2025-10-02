<template>
    <div class="screen-config">
        <h3>オープニング画面設定</h3>
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
            <label>コンテンツ:</label>
            <div v-for="(content, idx) in localConfig.contents" :key="idx" class="content-item">
                <select v-model="content.type" class="admin-input">
                    <option value="text">テキスト</option>
                    <option value="image">画像</option>
                </select>
                <input v-if="content.type === 'text'" v-model="content.text" placeholder="テキスト内容" class="admin-input" />
                <div v-if="content.type === 'image'">
                    <div class="asset-mode">
                        <label><input type="radio" v-model="content.imageMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="content.imageMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="content.imageMode === 'select'" v-model="content.assetId" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.url">{{ asset.name }}
                        </option>
                    </select>
                    <input v-if="content.imageMode === 'upload'" type="file" @change="(e) => onImageChange(e, idx)"
                        accept="image/*" class="admin-input" />
                </div>
                <select v-model="content.effect" class="admin-input">
                    <option value="scroll">スクロール</option>
                    <option value="fade">フェード</option>
                    <option value="static">静止</option>
                </select>
                <input v-model.number="content.duration" type="number" placeholder="表示時間(ms)" class="admin-input" />
                <div class="asset-mode">
                    <label><input type="radio" v-model="content.seMode" value="select" /> SE選択</label>
                    <label><input type="radio" v-model="content.seMode" value="upload" /> SEアップロード</label>
                </div>
                <select v-if="content.seMode === 'select'" v-model="content.seAssetId" class="admin-input">
                    <option value="">選択なし</option>
                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.url">{{ asset.name }}</option>
                </select>
                <input v-if="content.seMode === 'upload'" type="file" @change="(e) => onSeChange(e, idx)"
                    accept="audio/*" class="admin-input" />
                <button class="admin-btn" @click="removeContent(idx)">削除</button>
            </div>
            <button class="admin-btn" @click="addContent">コンテンツ追加</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, watch } from 'vue';

const props = defineProps<{
    audioAssets: any[];
    imageAssets: any[];
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

const onImageChange = (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            localConfig.value.contents[idx].assetId = ev.target?.result as string;
            emit('update', localConfig.value);
        };
        reader.readAsDataURL(file);
    }
};

const onSeChange = (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            localConfig.value.contents[idx].seAssetId = ev.target?.result as string;
            emit('update', localConfig.value);
        };
        reader.readAsDataURL(file);
    }
};

const addContent = () => {
    localConfig.value.contents.push({
        type: 'text',
        text: '',
        imageMode: 'select',
        assetId: '',
        effect: 'scroll',
        duration: 3000,
        seMode: 'select',
        seAssetId: '',
    });
    emit('update', localConfig.value);
};

const removeContent = (idx: number) => {
    localConfig.value.contents.splice(idx, 1);
    emit('update', localConfig.value);
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

.content-item {
    border: 1px solid #555;
    padding: 16px;
    margin-bottom: 16px;
    border-radius: 8px;
    background: #333;
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