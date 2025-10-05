<template>
    <div class="screen-config">
        <h3>説明画面設定</h3>
        <div class="config-item">
            <label>スライド:</label>
            <div v-for="(slide, idx) in config.slides" :key="idx" class="slide-item">
                <textarea v-model="slide.html" placeholder="HTML内容" class="admin-input" rows="4"></textarea>
                <div class="asset-mode">
                    <label><input type="radio" v-model="slide.imageMode" value="select" /> 画像選択</label>
                    <label><input type="radio" v-model="slide.imageMode" value="upload" /> 画像アップロード</label>
                </div>
                <select v-if="slide.imageMode === 'select'" v-model="slide.imageAssetId" class="admin-input">
                    <option value="">選択なし</option>
                    <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="slide.imageMode === 'upload'" type="file" @change="(e) => onImageChange(e, idx)"
                    accept="image/*" class="admin-input" />
                <div class="asset-mode">
                    <label><input type="radio" v-model="slide.bgmMode" value="select" /> BGM選択</label>
                    <label><input type="radio" v-model="slide.bgmMode" value="upload" /> BGMアップロード</label>
                </div>
                <select v-if="slide.bgmMode === 'select'" v-model="slide.bgmAssetId" class="admin-input">
                    <option value="">選択なし</option>
                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                </select>
                <input v-if="slide.bgmMode === 'upload'" type="file" @change="(e) => onBgmChange(e, idx)"
                    accept="audio/*" class="admin-input" />
                <select v-model="slide.effect" class="admin-input">
                    <option value="fade">フェード</option>
                    <option value="zoom">ズーム</option>
                </select>
                <input v-model.number="slide.duration" type="number" placeholder="表示時間(ms)" class="admin-input" />
                <button class="admin-btn" @click="removeSlide(idx)">削除</button>
            </div>
            <button class="admin-btn" @click="addSlide">スライド追加</button>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, defineEmits, watch } from 'vue';

const props = defineProps<{
    audioAssets: any[];
    imageAssets: any[];
    assetService: any;
    config?: any;
}>();

const emit = defineEmits<{
    update: [config: any];
    uploading: [isUploading: boolean];
}>();

const config = ref(props.config ? JSON.parse(JSON.stringify(props.config)) : { slides: [] as any[] });

// keep local config in sync with parent-provided config
watch(() => props.config, (newCfg: any) => {
    config.value = newCfg ? JSON.parse(JSON.stringify(newCfg)) : { slides: [] };
}, { deep: true });

// propagate local edits (textarea, select changes, etc.) to parent so the
// parent has the latest values before saving. This prevents situations where
// in-memory child state diverges from parent and causes create/update logic
// to misfire.
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

const onImageChange = async (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        emit('uploading', true);
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.slides[idx].imageAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload image:', error);
        } finally {
            emit('uploading', false);
        }
    }
};

const onBgmChange = async (e: Event, idx: number) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        emit('uploading', true);
        try {
            const result = await props.assetService.addAssets([file]);
            if (result.successful.length > 0) {
                config.value.slides[idx].bgmAssetId = result.successful[0].id;
                emit('update', config.value);
            }
        } catch (error) {
            console.error('Failed to upload BGM:', error);
        } finally {
            emit('uploading', false);
        }
    }
};

const addSlide = () => {
    config.value.slides.push({
        html: '',
        imageMode: 'select',
        imageAssetId: '',
        bgmMode: 'select',
        bgmAssetId: '',
        effect: 'fade',
        duration: 5000,
    });
    emit('update', config.value);
};

const removeSlide = (idx: number) => {
    config.value.slides.splice(idx, 1);
    emit('update', config.value);
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

.slide-item {
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

textarea.admin-input {
    resize: vertical;
    min-height: 100px;
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

.slide-item,
.config-item {
    min-width: 0;
}
</style>