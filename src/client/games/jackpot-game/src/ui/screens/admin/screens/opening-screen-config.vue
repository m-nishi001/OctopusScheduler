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
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
            </select>
            <input v-if="localConfig.bgmMode === 'upload'" type="file" @change="onBgmChange" accept="audio/*"
                class="admin-input" />
        </div>
        <div class="config-item">
            <label>コンテンツ:</label>
            <div class="display-mode">
                <label>表示モード:</label>
                <select v-model="localConfig.displayMode" class="admin-input">
                    <option value="list">従来リスト</option>
                    <option value="html">HTML（フルスクリーン）</option>
                </select>
            </div>
            <div v-for="(content, idx) in localConfig.contents" :key="idx" class="content-item">
                <select v-model="content.type" class="admin-input">
                    <option value="text">テキスト</option>
                    <option value="image">画像</option>
                    <option value="html">HTML</option>
                </select>
                <input v-if="content.type === 'text'" v-model="content.text" placeholder="テキスト内容" class="admin-input" />
                <textarea v-if="content.type === 'html'" v-model="content.content" placeholder="HTMLを入力"
                    class="admin-input" rows="6"></textarea>
                <div v-if="content.type === 'image'">
                    <div class="asset-mode">
                        <label><input type="radio" v-model="content.imageMode" value="select" /> 既存から選択</label>
                        <label><input type="radio" v-model="content.imageMode" value="upload" /> アップロード</label>
                    </div>
                    <select v-if="content.imageMode === 'select'" v-model="content.assetId" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
                        </option>
                    </select>
                    <img v-if="content.imageMode === 'select' && content.assetId" :src="getAssetUrl(content.assetId)"
                        style="max-width:200px;max-height:200px;margin-top:8px;border-radius:8px;" />
                    <input v-if="content.imageMode === 'upload'" type="file" @change="(e) => onImageChange(e, idx)"
                        accept="image/*" class="admin-input" />
                </div>
                <select v-model="content.effect" class="admin-input">
                    <option value="scroll">スクロール</option>
                    <option value="fade">フェード</option>
                    <option value="static">静止</option>
                </select>
                <input v-model.number="content.duration" type="number" placeholder="表示時間(ms)" class="admin-input" />
                <div v-if="content.effect === 'scroll'">
                    <label>スクロール方向:</label>
                    <select v-model="content.scrollDirection" class="admin-input">
                        <option value="up">上へ</option>
                        <option value="down">下へ</option>
                        <option value="left">左へ</option>
                        <option value="right">右へ</option>
                    </select>
                </div>
                <div class="asset-mode">
                    <label><input type="radio" v-model="content.seMode" value="select" /> SE選択</label>
                    <label><input type="radio" v-model="content.seMode" value="upload" /> SEアップロード</label>
                </div>
                <select v-if="content.seMode === 'select'" v-model="content.seAssetId" class="admin-input">
                    <option value="">選択なし</option>
                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
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
    assetService: any;
    config: any;
}>();

const emit = defineEmits<{
    update: [config: any];
    uploading: [isUploading: boolean];
}>();

const normalizeConfig = (cfg: any) => {
    if (!cfg) return {
        id: '',
        bgmMode: 'select',
        bgmAssetId: '',
        displayMode: 'list',
        contents: [] as any[],
    };
    const copy = JSON.parse(JSON.stringify(cfg));
    copy.bgmMode = copy.bgmMode || 'select';
    copy.bgmAssetId = copy.bgmAssetId || '';
    copy.displayMode = copy.displayMode || 'list';
    copy.contents = Array.isArray(copy.contents) ? copy.contents.map((c: any) => ({
        id: c.id || '',
        type: c.type || 'text',
        text: c.content || c.text || '',
        content: c.content || '',
        assetId: c.assetId || '',
        imageMode: c.imageMode || (c.assetId ? 'select' : 'select'),
        seMode: c.seMode || 'select',
        effect: c.effect || c.animation?.type || 'fade',
        duration: c.duration || c.animation?.duration || 3000,
        scrollDirection: c.scrollDirection || c.animation?.scrollDirection || 'up',
        seAssetId: c.seAssetId || '',
    })) : [];
    return copy;
};

const localConfig = ref(normalizeConfig(props.config));

watch(() => props.config, (newConfig) => {
    localConfig.value = normalizeConfig(newConfig);
}, { deep: true });

// propagate local edits to parent so parent can save the latest config
watch(localConfig, (newVal) => {
    try {
        const normalizedProp = normalizeConfig(props.config);
        // only emit if there's an actual difference to avoid feedback loop
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
        emit('uploading', true);
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                localConfig.value.bgmAssetId = result.successful[0].id;
                emit('update', localConfig.value);
            }
        } catch (error) {
            console.error('Failed to upload BGM:', error);
        } finally {
            emit('uploading', false);
        }
    }
};

const onImageChange = async (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        emit('uploading', true);
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                localConfig.value.contents[idx].assetId = result.successful[0].id;
                emit('update', localConfig.value);
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
        } finally {
            emit('uploading', false);
        }
    }
};

const onSeChange = async (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        emit('uploading', true);
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                localConfig.value.contents[idx].seAssetId = result.successful[0].id;
                emit('update', localConfig.value);
            }
        } catch (error) {
            console.error('Failed to upload SE:', error);
        } finally {
            emit('uploading', false);
        }
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
        scrollDirection: 'up',
        seMode: 'select',
        seAssetId: '',
        content: '',
    });
    emit('update', localConfig.value);
};

const removeContent = (idx: number) => {
    localConfig.value.contents.splice(idx, 1);
    emit('update', localConfig.value);
};

const getAssetUrl = (assetId: string) => {
    const asset = props.imageAssets.find(a => a.id === assetId);
    return asset ? asset.url : '';
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
    max-width: 100%;
    box-sizing: border-box;
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

/* Ensure children in the config area use border-box sizing so padding doesn't cause overflow */
.screen-config,
.screen-config * {
    box-sizing: border-box;
}

/* Prevent content boxes from allowing children to overflow horizontally */
.content-item {
    overflow: hidden;
    word-break: break-word;
}

textarea.admin-input {
    white-space: pre-wrap;
    overflow-wrap: break-word;
}
</style>