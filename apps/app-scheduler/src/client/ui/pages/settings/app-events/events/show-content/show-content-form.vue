<template>
    <div v-bind="$attrs">
        <div class="form-group">
            <label for="contentType">コンテンツ種別</label>
            <select id="contentType" v-model="formData.contentType">
                <option value="image">画像</option>
                <option value="movie">動画</option>
                <option value="html">HTML</option>
            </select>
        </div>

        <!-- 画像・動画: 既存のアセットを選ぶか、ファイルを選ぶ(ファイルは保存のときにアップロードする) -->
        <div v-if="formData.contentType !== 'html'" class="form-group">
            <label for="contentAsset">{{ formData.contentType === 'image' ? '画像' : '動画' }}</label>
            <div class="content-selection">
                <select id="contentAsset" v-model="formData.contentId" :required="!mainUpload">
                    <option v-if="mainUpload" :value="mainUpload.tempId">{{ mainUpload.file.name }} (保存時にアップロード)</option>
                    <option value="">選択してください</option>
                    <option v-for="asset in mediaAssets" :key="asset.id" :value="asset.id">{{ asset.name || asset.id }}</option>
                </select>
                <button type="button" class="icon-button" aria-label="ファイルを選ぶ" @click="mainFileInput?.click()">+</button>
                <button type="button" class="icon-button" aria-label="プレビュー" :disabled="!formData.contentId" @click="openPreview">▶️</button>
            </div>
            <input ref="mainFileInput" type="file" :accept="formData.contentType === 'image' ? 'image/*' : 'video/*'"
                style="display: none;" @change="onMainFile" />
        </div>

        <!-- HTML: 本文と、アセットの挿入 -->
        <template v-else>
            <div class="form-group">
                <label for="htmlString">HTML文字列</label>
                <textarea id="htmlString" ref="htmlTextarea" v-model="formData.htmlString" rows="8" required
                    placeholder="HTMLを入力してください"></textarea>
                <div class="asset-insert">
                    <select v-model="insertType" aria-label="挿入する種類">
                        <option value="image">画像</option>
                        <option value="video">動画</option>
                    </select>
                    <select v-model="insertAssetId" aria-label="挿入するアセット">
                        <option value="">既存のアセットから選択</option>
                        <option v-for="asset in insertableAssets" :key="asset.id" :value="asset.id">{{ asset.name || asset.id }}</option>
                    </select>
                    <button type="button" :disabled="!insertAssetId" @click="insertExisting">挿入</button>
                    <button type="button" class="icon-button" aria-label="ファイルを選んで挿入" @click="insertFileInput?.click()">+</button>
                    <input ref="insertFileInput" type="file" :accept="insertType === 'image' ? 'image/*' : 'video/*'"
                        style="display: none;" @change="onInsertFile" />
                </div>
            </div>
            <div class="form-group">
                <label>プレビュー</label>
                <div class="html-preview" v-html="previewHtml"></div>
            </div>
        </template>

        <div class="form-group">
            <label for="effect">表示方法</label>
            <select id="effect" v-model="formData.effect">
                <option value="fade">フェード</option>
                <option value="scroll">スクロール</option>
                <option value="static">静的表示</option>
            </select>
        </div>
        <template v-if="formData.effect === 'fade'">
            <div class="form-group">
                <label for="fadeInTime">フェードイン時間 (秒)</label>
                <input id="fadeInTime" v-model.number="formData.fadeInTime" type="number" step="0.1" min="0" />
            </div>
            <div class="form-group">
                <label for="fadeOutTime">フェードアウト時間 (秒)</label>
                <input id="fadeOutTime" v-model.number="formData.fadeOutTime" type="number" step="0.1" min="0" />
            </div>
        </template>
        <div v-if="formData.effect === 'scroll'" class="form-group">
            <label for="scrollDirection">スクロール方向</label>
            <select id="scrollDirection" v-model="formData.scrollDirection">
                <option value="up">上</option>
                <option value="down">下</option>
                <option value="left">左</option>
                <option value="right">右</option>
            </select>
        </div>
        <div v-if="formData.effect !== 'fade'" class="form-group">
            <label for="duration">表示時間 (秒)</label>
            <input id="duration" v-model.number="formData.duration" type="number" step="0.1" min="0" />
        </div>

        <UiDialog :model-value="!!preview" title="プレビュー" size="lg" nested @close="preview = null">
            <img v-if="preview?.kind === 'image'" :src="preview.url" alt="preview" class="preview-media" />
            <video v-else-if="preview?.kind === 'movie'" :src="preview.url" controls class="preview-media" />
            <template #footer>
                <UiButton @click="preview = null">閉じる</UiButton>
            </template>
        </UiDialog>
    </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { container } from 'tsyringe';
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { assetPlaceholder, listAssetPlaceholderIds, renderAssetPlaceholders } from '@octopus/client-common/assets/asset-placeholder';
import { AssetService } from '../../../../../../control/asset/asset-service';
import { AppEventService } from '../../../../../../control/app-event/app-event-service';
import type { ShowContentEventDto } from '../../../../../../control/app-event/dto/app-event-dto';
import type { Asset } from '../../../../../../model/asset/asset';

type Props = { initialData?: ShowContentEventDto }
type PendingUpload = { tempId: string; file: File };

const props = defineProps<Props>();
const emit = defineEmits<{ save: [ShowContentEventDto] }>();

const assetService = container.resolve(AssetService);
const appEventService = container.resolve(AppEventService);

const initialFields = () => ({
    contentType: props.initialData?.contentType ?? 'image',
    contentId: props.initialData?.contentId ?? '',
    htmlString: props.initialData?.htmlString ?? '',
    effect: props.initialData?.effect ?? 'fade',
    fadeInTime: props.initialData?.fadeInTime ?? 1,
    fadeOutTime: props.initialData?.fadeOutTime ?? 1,
    duration: props.initialData?.duration ?? 3,
    scrollDirection: props.initialData?.scrollDirection ?? 'up',
});
const formData = reactive(initialFields());

const assets = ref<Asset[]>([]);
/** まだアップロードしていない、選択済みのファイル。保存のときにアセットになり、仮の id が本物の id に置き換わる。 */
const pendingUploads = ref<PendingUpload[]>([]);
/** 仮の id・アセット id → プレビュー用の URL。 */
const previewUrls = reactive(new Map<string, string>());
const preview = ref<{ kind: 'image' | 'movie'; url: string } | null>(null);

const mainFileInput = ref<HTMLInputElement | null>(null);
const insertFileInput = ref<HTMLInputElement | null>(null);
const htmlTextarea = ref<HTMLTextAreaElement | null>(null);
const insertType = ref<'image' | 'video'>('image');
const insertAssetId = ref('');

const mediaType = (kind: string) => (kind === 'image' ? 'image' : 'video');
const assetsOf = (type: string) => assets.value.filter((a) => a.blob.type.startsWith(type + '/'));
const mediaAssets = computed(() => assetsOf(mediaType(formData.contentType)));
const insertableAssets = computed(() => assetsOf(insertType.value));
const mainUpload = computed(() => pendingUploads.value.find((u) => u.tempId === formData.contentId) ?? null);

const tempId = () => 'TMP_' + Math.random().toString(36).slice(2, 9);

function setPreviewUrl(id: string, blob: Blob) {
    revokePreviewUrl(id);
    previewUrls.set(id, URL.createObjectURL(blob));
}
function revokePreviewUrl(id: string) {
    const url = previewUrls.get(id);
    if (url) URL.revokeObjectURL(url);
    previewUrls.delete(id);
}

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
onBeforeUnmount(() => {
    window.removeEventListener('assets:updated', onAssetsUpdated);
    if (preview.value) URL.revokeObjectURL(preview.value.url);
    for (const id of [...previewUrls.keys()]) revokePreviewUrl(id);
});

function onMainFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (mainUpload.value) dropPending(mainUpload.value.tempId);
    const id = tempId();
    pendingUploads.value.push({ tempId: id, file });
    setPreviewUrl(id, file);
    formData.contentId = id;
}

function dropPending(id: string) {
    pendingUploads.value = pendingUploads.value.filter((u) => u.tempId !== id);
    revokePreviewUrl(id);
}

async function openPreview() {
    if (formData.contentType === 'html' || !formData.contentId) return;
    const pending = mainUpload.value;
    const blob = pending?.file ?? assets.value.find((a) => a.id === formData.contentId)?.blob;
    if (!blob) return;
    preview.value = { kind: formData.contentType, url: URL.createObjectURL(blob) };
}
watch(preview, (_next, prev) => { if (prev) URL.revokeObjectURL(prev.url); });

/** カーソル位置にテキストを入れる。 */
function insertAtCursor(text: string) {
    const el = htmlTextarea.value;
    const start = el?.selectionStart ?? formData.htmlString.length;
    const end = el?.selectionEnd ?? start;
    formData.htmlString = formData.htmlString.slice(0, start) + text + formData.htmlString.slice(end);
    el?.focus();
    el?.setSelectionRange(start + text.length, start + text.length);
}

function insertExisting() {
    if (insertAssetId.value) insertAtCursor(assetPlaceholder(insertType.value, insertAssetId.value));
    insertAssetId.value = '';
}

function onInsertFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const id = tempId();
    pendingUploads.value.push({ tempId: id, file });
    setPreviewUrl(id, file);
    insertAtCursor(assetPlaceholder(insertType.value, id));
}

/** HTML の `{{asset:…}}` を、プレビュー用の URL に置き換えた HTML。URL が未取得のアセットは先に読み込む。 */
const previewHtml = computed(() => renderAssetPlaceholders(formData.htmlString, (id) => previewUrls.get(id)));
watch(() => formData.htmlString, async (html) => {
    for (const id of listAssetPlaceholderIds(html)) {
        if (previewUrls.has(id)) continue;
        try {
            const asset = await assetService.getAssetById(id);
            if (asset?.blob) setPreviewUrl(id, asset.blob);
        } catch (e) {
            console.error('Failed to load asset for preview:', id, e);
        }
    }
});

/** 使われているファイルだけをアップロードして、仮の id を本物の id に置き換えた結果を渡す。 */
const save = async () => {
    const isHtml = formData.contentType === 'html';
    const usedInHtml = new Set(listAssetPlaceholderIds(formData.htmlString));
    const used = pendingUploads.value.filter((u) =>
        isHtml ? usedInHtml.has(u.tempId) : u.tempId === formData.contentId
    );
    const resolved = await appEventService.resolveShowContentUploads(
        isHtml ? '' : formData.contentId,
        isHtml ? formData.htmlString : '',
        used
    );
    const base: ShowContentEventDto = {
        actionType: 'ShowContentEvent',
        contentType: formData.contentType,
        contentId: isHtml ? '' : resolved.contentId,
        htmlString: isHtml ? resolved.htmlString : undefined,
        displayMode: props.initialData?.displayMode,
        fadeOutDuration: props.initialData?.fadeOutDuration,
        effect: formData.effect,
        duration: formData.duration,
        fadeInTime: formData.fadeInTime,
        fadeOutTime: formData.fadeOutTime,
        scrollDirection: formData.scrollDirection,
    };
    emit('save', props.initialData?.id ? { ...base, id: props.initialData.id } : base);
};

const reset = () => {
    Object.assign(formData, initialFields());
    for (const u of pendingUploads.value) revokePreviewUrl(u.tempId);
    pendingUploads.value = [];
    insertAssetId.value = '';
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
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 8px;
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
}

.content-selection,
.asset-insert {
    display: flex;
    gap: 10px;
    align-items: center;
    margin-top: 6px;
}

.content-selection select,
.asset-insert select:last-of-type {
    flex: 1;
}

.icon-button {
    flex: none;
    width: 40px;
    height: 40px;
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 4px;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    cursor: pointer;
    font-weight: bold;
}

.html-preview {
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 6px;
    padding: 0.5em;
    background: var(--ui-bg, #23252b);
    color: var(--ui-text, #fff);
    max-height: 200px;
    overflow-y: auto;
}

.preview-media {
    display: block;
    max-width: 100%;
    max-height: 70dvh;
    margin: 0 auto;
}
</style>
