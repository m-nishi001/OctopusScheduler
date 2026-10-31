<template>
    <div v-bind="$attrs">
        <div class="form-group">
            <label for="screenKind">表示するもの</label>
            <select id="screenKind" v-model="formData.kind">
                <option value="image">画像</option>
                <option value="video">動画</option>
                <option value="slideshow">スライドショー</option>
            </select>
        </div>

        <!-- 画像・動画: 既存のアセットを選ぶか、ファイルを選ぶ(ファイルは保存のときにアップロードする) -->
        <div v-if="formData.kind !== 'slideshow'" class="form-group">
            <label for="screenAsset">{{ formData.kind === 'image' ? '画像' : '動画' }}</label>
            <div class="asset-selection">
                <select id="screenAsset" v-model="formData.id" :required="!pendingFile">
                    <option value="">選択してください</option>
                    <option v-for="asset in mediaAssets" :key="asset.id" :value="asset.id">{{ asset.name || asset.id }}</option>
                </select>
                <button type="button" class="icon-button" aria-label="ファイルを選ぶ" @click="fileInput?.click()">+</button>
            </div>
            <input ref="fileInput" type="file" :accept="formData.kind === 'image' ? 'image/*' : 'video/*'"
                style="display: none;" @change="onFile" />
            <span v-if="pendingFile" class="file-name">{{ pendingFile.name }} (保存時にアップロード)</span>
        </div>

        <template v-else>
            <div class="form-group">
                <label for="folder">フォルダ名 (assets 配下)</label>
                <input id="folder" v-model="formData.folder" type="text" placeholder="slideshow-1" required />
            </div>
            <div class="form-group">
                <label for="intervalSec">1枚あたりの表示時間 (秒)</label>
                <input id="intervalSec" v-model.number="formData.intervalSec" type="number" min="1" required />
            </div>
            <div class="form-group">
                <label for="transition">切替アクション</label>
                <select id="transition" v-model="formData.transition">
                    <option value="fade">フェード</option>
                    <option value="slide">スライド</option>
                </select>
            </div>
        </template>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../../../control/asset/asset-service';
import type { ScreenEventDto } from '../../../../../../control/app-event/dto/app-event-dto';
import type { Asset } from '../../../../../../model/asset/asset';
import { classifyMedia } from '../../../../../../model/media/media-kind';
import { parseScreenSpec, type ScreenSpec } from '../../../../../../model/media/screen-spec';

type Props = { initialData?: ScreenEventDto }

const props = defineProps<Props>();
const emit = defineEmits<{ save: [ScreenEventDto] }>();

const assetService = container.resolve(AssetService);

const initialFields = () => {
    const spec = props.initialData?.spec;
    return {
        kind: (spec?.kind ?? 'image') as ScreenSpec['kind'],
        id: spec && spec.kind !== 'slideshow' ? spec.id : '',
        folder: spec?.kind === 'slideshow' ? spec.folder : '',
        intervalSec: spec?.kind === 'slideshow' ? spec.intervalSec : 5,
        transition: (spec?.kind === 'slideshow' ? spec.transition : 'fade') as 'fade' | 'slide',
    };
};
const formData = reactive(initialFields());

const assets = ref<Asset[]>([]);
/** まだアップロードしていない、選択済みのファイル。保存のときにアセットになる。 */
const pendingFile = ref<File | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const mediaAssets = computed(() => assets.value.filter((a) => classifyMedia(a.blob.type, a.name) === formData.kind));

async function refreshAssets() {
    try {
        assets.value = await assetService.getAssets();
    } catch (e) {
        console.error('Failed to load assets:', e);
    }
}
const onAssetsUpdated = () => { void refreshAssets(); };
onMounted(async () => {
    await refreshAssets();
    window.addEventListener('assets:updated', onAssetsUpdated);
});
onBeforeUnmount(() => window.removeEventListener('assets:updated', onAssetsUpdated));

// 種類を変えたら、前の種類で選んだものは外す
watch(() => formData.kind, () => {
    formData.id = '';
    pendingFile.value = null;
});

function onFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    pendingFile.value = file;
    formData.id = '';
}

const save = async () => {
    let id = formData.id;
    if (formData.kind !== 'slideshow' && pendingFile.value) {
        const file = pendingFile.value;
        try {
            const now = new Date().toISOString();
            [id] = await assetService.addAssets([{ id: '', blob: file, name: file.name, uploadedAt: now, lastUpdated: now, size: file.size }]);
        } catch (e) {
            throw new Error('アセットのアップロードに失敗しました: ' + (e instanceof Error ? e.message : String(e)));
        }
        formData.id = id;
        pendingFile.value = null;
        await refreshAssets();
    }
    const spec = parseScreenSpec(
        formData.kind === 'slideshow'
            ? { kind: 'slideshow', folder: formData.folder, intervalSec: formData.intervalSec, transition: formData.transition }
            : { kind: formData.kind, id }
    );
    if (!spec) throw new Error('表示するものの指定が正しくありません。');
    const base: ScreenEventDto = { actionType: 'ScreenEvent', spec };
    emit('save', props.initialData?.id ? { ...base, id: props.initialData.id } : base);
};

const reset = () => {
    Object.assign(formData, initialFields());
    pendingFile.value = null;
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

.asset-selection {
    display: flex;
    gap: 10px;
    align-items: center;
}

.asset-selection select {
    flex: 1;
}

.icon-button {
    width: 40px;
    height: 40px;
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    cursor: pointer;
    font-weight: bold;
}

.file-name {
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted);
}
</style>
