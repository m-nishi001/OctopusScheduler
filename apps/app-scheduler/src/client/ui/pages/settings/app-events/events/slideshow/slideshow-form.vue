<template>
    <div v-bind="$attrs">
        <div class="form-group">
            <label for="folderId">フォルダ名 (assets 配下)</label>
            <input id="folderId" v-model="formData.folderId" type="text" placeholder="slideshow-1" required />
        </div>
        <div class="form-group">
            <label for="displayDuration">表示時間 (秒)</label>
            <input id="displayDuration" v-model.number="formData.displayDuration" type="number" min="1" required />
        </div>
        <div class="form-group">
            <label for="transitionType">切替アクション</label>
            <select id="transitionType" v-model="formData.transitionType">
                <option value="fade">フェード</option>
                <option value="slide">スライド</option>
            </select>
        </div>
        <div v-if="formData.transitionType === 'slide'" class="form-group">
            <label for="slideDirection">スライド方向</label>
            <select id="slideDirection" v-model="formData.slideDirection">
                <option value="left">左</option>
                <option value="right">右</option>
                <option value="up">上</option>
                <option value="down">下</option>
            </select>
        </div>
        <div class="form-group">
            <label>BGM アセット</label>
            <div class="bgm-list">
                <div v-for="(id, index) in formData.bgmIds" :key="id" class="bgm-item">
                    <span>{{ assetName(id) }}</span>
                    <button type="button" class="remove-btn" aria-label="BGM を外す" @click="formData.bgmIds.splice(index, 1)">×</button>
                </div>
                <div class="bgm-add">
                    <select v-model="selectedBgmId" aria-label="追加する BGM">
                        <option value="">既存のアセットから選択</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                    <button type="button" :disabled="!selectedBgmId" @click="addSelectedBgm">追加</button>
                    <button type="button" class="upload-button" aria-label="BGM をアップロード" @click="fileInput?.click()">+</button>
                    <input ref="fileInput" type="file" accept="audio/*" style="display: none;" @change="uploadBgm" />
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { toast } from '@octopus/ui-kit';
import { AssetService } from '../../../../../../control/asset/asset-service';
import type { Asset } from '../../../../../../model/asset/asset';
import type { SlideshowEventDto } from '../../../../../../control/app-event/dto/app-event-dto';

type Props = { initialData?: SlideshowEventDto }

const props = defineProps<Props>();
const emit = defineEmits<{ save: [SlideshowEventDto] }>();

const assetService = container.resolve(AssetService);
const assets = ref<Asset[]>([]);
const audioAssets = computed(() => assets.value.filter((a) => a.blob.type.startsWith('audio/')));
const assetName = (id: string) => assets.value.find((a) => a.id === id)?.name ?? id;
const selectedBgmId = ref('');
const fileInput = ref<HTMLInputElement | null>(null);

const initialFields = () => ({
    folderId: props.initialData?.folderId ?? '',
    displayDuration: props.initialData?.displayDuration ?? 5,
    transitionType: props.initialData?.transitionType ?? 'fade',
    slideDirection: props.initialData?.slideDirection ?? 'left',
    bgmIds: [...(props.initialData?.bgmIds ?? [])],
});
const formData = reactive(initialFields());

async function refreshAssets() {
    try {
        assets.value = await assetService.getAssets();
    } catch (e) {
        console.error('Failed to load assets:', e);
    }
}
onMounted(refreshAssets);

function addSelectedBgm() {
    if (selectedBgmId.value && !formData.bgmIds.includes(selectedBgmId.value)) formData.bgmIds.push(selectedBgmId.value);
    selectedBgmId.value = '';
}

/** 選んだ音声を、その場でアセットに登録して BGM に加える。 */
async function uploadBgm(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    try {
        const now = new Date().toISOString();
        const [id] = await assetService.addAssets([{ id: '', blob: file, name: file.name, uploadedAt: now, lastUpdated: now, size: file.size }]);
        await refreshAssets();
        if (id && !formData.bgmIds.includes(id)) formData.bgmIds.push(id);
    } catch (e) {
        toast.error('アセットアップロードに失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

const save = () => {
    const base: SlideshowEventDto = {
        actionType: 'SlideshowEvent',
        folderId: formData.folderId,
        displayDuration: formData.displayDuration,
        transitionType: formData.transitionType,
        slideDirection: formData.transitionType === 'slide' ? formData.slideDirection : undefined,
        bgmIds: [...formData.bgmIds],
    };
    emit('save', props.initialData?.id ? { ...base, id: props.initialData.id } : base);
};

const reset = () => {
    Object.assign(formData, initialFields());
    selectedBgmId.value = '';
};

watch(() => props.initialData, reset);

defineExpose({ save, reset });
</script>

<style scoped>
.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
}

.form-group input,
.form-group select {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
}

.bgm-list {
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 6px;
    padding: 0.5em;
    background: var(--ui-bg, #23252b);
}

.bgm-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5em;
    background: var(--ui-surface, #2b3036);
    margin-bottom: 0.5em;
    border-radius: 4px;
}

.remove-btn {
    background: var(--ui-danger, #e5484d);
    color: var(--ui-text, #fff);
    border: none;
    border-radius: 4px;
    padding: 0.2em 0.5em;
    cursor: pointer;
}

.bgm-add {
    display: flex;
    gap: 0.5em;
    align-items: center;
}

.bgm-add select {
    flex: 1;
}

.upload-button {
    width: 40px;
    height: 40px;
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    cursor: pointer;
    font-weight: bold;
}
</style>
