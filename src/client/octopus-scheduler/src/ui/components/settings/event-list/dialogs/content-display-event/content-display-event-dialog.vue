<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? 'コンテンツ表示イベント編集' : 'コンテンツ表示イベント追加' }}</h3>
            <form @submit.prevent="onSubmit">
                <div class="form-group">
                    <label for="startTime">開始時間</label>
                    <input id="startTime" type="datetime-local" v-model="form.startTime" required />
                </div>
                <div class="form-group">
                    <label for="endTime">終了時間</label>
                    <input id="endTime" type="datetime-local" v-model="form.endTime" required />
                </div>
                <div class="form-group">
                    <label for="contentType">コンテンツ種別</label>
                    <select id="contentType" v-model="form.contentType" required>
                        <option value="image">画像</option>
                        <option value="movie">動画</option>
                        <option value="html">HTML</option>
                    </select>
                </div>
                <div class="form-group" v-if="form.contentType !== 'html'">
                    <label>アセットソース</label>
                    <div class="radio-group">
                        <label>
                            <input type="radio" value="existing" v-model="form.assetSource" />
                            既存アセットを選択
                        </label>
                        <label>
                            <input type="radio" value="upload" v-model="form.assetSource" />
                            新規アップロード
                        </label>
                    </div>
                </div>
                <div class="form-group" v-if="form.contentType !== 'html' && form.assetSource === 'existing'">
                    <label for="selectedAsset">既存アセット</label>
                    <select id="selectedAsset" v-model="form.selectedAssetId" required>
                        <option value="">選択してください</option>
                        <option v-for="asset in filteredAssets" :key="asset.id" :value="asset.id">
                            {{ asset.name }}
                        </option>
                    </select>
                </div>
                <div class="form-group" v-if="form.contentType !== 'html' && form.assetSource === 'upload'">
                    <label for="uploadFile">アップロードファイル</label>
                    <div class="file-picker">
                        <input id="uploadFile" ref="fileInput" class="hidden-file-input" type="file"
                            @change="onFileChange" accept=".jpg,.jpeg,.png,.gif,.mp4,.webm,.ogg" />
                        <button type="button" class="file-btn" @click.prevent="openFilePicker">Choose File</button>
                        <span class="file-name">{{ mainUploadEntry ? mainUploadEntry.file.name : 'No file chosen'
                        }}</span>
                        <button v-if="mainUploadEntry" type="button" class="clear-btn"
                            @click.prevent="clearFile">×</button>
                    </div>
                </div>
                <div class="form-group" v-if="form.contentType === 'html'">
                    <label for="htmlString">HTML文字列</label>
                    <textarea id="htmlString" ref="htmlTextarea" v-model="form.htmlString" required></textarea>
                    <div class="asset-insert-section">
                        <label>アセット挿入</label>
                        <div class="radio-group">
                            <label>
                                <input type="radio" value="existing" v-model="form.assetInsertSource" />
                                既存アセットを選択
                            </label>
                            <label>
                                <input type="radio" value="upload" v-model="form.assetInsertSource" />
                                新規アップロード
                            </label>
                        </div>
                        <div v-if="form.assetInsertSource === 'existing'" class="asset-insert-controls">
                            <select v-model="form.insertAssetType">
                                <option value="image">画像</option>
                                <option value="video">動画</option>
                            </select>
                            <select v-model="form.insertAssetId">
                                <option value="">選択してください</option>
                                <option v-for="asset in filteredInsertAssets" :key="asset.id" :value="asset.id">
                                    {{ asset.name }}
                                </option>
                            </select>
                            <button type="button" @click="insertAsset" :disabled="!form.insertAssetId">挿入</button>
                        </div>
                        <div v-if="form.assetInsertSource === 'upload'" class="asset-insert-controls">
                            <select v-model="form.insertAssetType">
                                <option value="image">画像</option>
                                <option value="video">動画</option>
                            </select>
                            <div class="file-picker">
                                <input ref="insertFileInput" class="hidden-file-input" type="file"
                                    @change="onInsertFileChange"
                                    :accept="form.insertAssetType === 'image' ? 'image/*' : 'video/*'" />
                                <button type="button" class="file-btn" @click.prevent="openInsertFilePicker">Choose
                                    File</button>
                            </div>
                        </div>
                    </div>
                </div>
                <div v-if="form.contentType === 'html'" class="form-group">
                    <label>プレビュー</label>
                    <div class="html-preview" v-html="processedHtml"></div>
                </div>
                <div class="form-group">
                    <label for="displayMode">表示方法</label>
                    <select id="displayMode" v-model="form.effect">
                        <option value="fade">フェード</option>
                        <option value="scroll">スクロール</option>
                        <option value="static">静的表示</option>
                    </select>
                </div>
                <div v-if="form.effect === 'fade'" class="form-group">
                    <label for="fadeInTime">フェードイン時間 (秒)</label>
                    <input id="fadeInTime" type="number" step="0.1" v-model.number="form.fadeInTime" min="0" />
                </div>
                <div v-if="form.effect === 'fade'" class="form-group">
                    <label for="fadeOutTime">フェードアウト時間 (秒)</label>
                    <input id="fadeOutTime" type="number" step="0.1" v-model.number="form.fadeOutTime" min="0" />
                </div>
                <div v-if="form.effect === 'scroll'" class="form-group">
                    <label for="scrollDirection">スクロール方向</label>
                    <select id="scrollDirection" v-model="form.scrollDirection">
                        <option value="up">上</option>
                        <option value="down">下</option>
                        <option value="left">左</option>
                        <option value="right">右</option>
                    </select>
                </div>
                <div v-if="form.effect === 'scroll' || form.effect === 'static'" class="form-group">
                    <label for="duration">表示時間 (秒)</label>
                    <input id="duration" type="number" step="0.1" v-model.number="form.duration" min="0" />
                </div>
                <div class="form-actions">
                    <button type="button" class="main-btn" @click="onClose">キャンセル</button>
                    <button type="submit" class="main-btn">{{ isEdit ? '更新' : '追加' }}</button>
                </div>
            </form>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../../../model/applications/assets/asset-service';
import type { Asset } from '../../../../../../model/domains/assets/entity/asset';
import { ScheduleEventService } from '../../../../../../model/applications/schedule-event/schedule-event-service';
import { ShowContentEvent } from '../../../../../../model/domains/schedule-event/show-content/show-content-event';
import { ContentDisplayEventRegister } from './content-display-event-register';

interface Props {
    event?: ShowContentEvent;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    saved: [];
    close: [];
}>();

const isEdit = ref(!!props.event);

function entityToForm(e: ShowContentEvent) {
    return {
        startTime: formatDateTime(e.startTime),
        endTime: formatDateTime(e.endTime),
        contentType: e.contentType,
        contentId: e.contentId ?? '',
        htmlString: e.htmlString ?? '',
        fadeOutDuration: e.fadeOutDuration ?? 0,
        displayMode: e.displayMode ?? 'fade',
        effect: e.effect ?? 'fade',
        duration: e.duration ?? 3,
        fadeInTime: e.fadeInTime ?? 1,
        fadeOutTime: e.fadeOutTime ?? 1,
        scrollDirection: e.scrollDirection ?? 'up',
        assetSource: 'existing' as 'existing' | 'upload',
        selectedAssetId: e.contentId ?? '',
        assetInsertSource: 'existing' as 'existing' | 'upload',
        insertAssetType: 'image' as 'image' | 'video',
        insertAssetId: '',
        uploadFiles: [] as Array<{ tempId: string; file: File }>,
    };
}

const initialEntity = props.event ?? ShowContentEvent.createEmpty();
const form = ref(entityToForm(initialEntity));

const assets = ref<Asset[]>([]);
const assetService = container.resolve(AssetService);

const assetMap = ref<Map<string, string>>(new Map());
const createdUrls: string[] = [];

function generateTempId() {
    return 'TMP_' + Math.random().toString(36).slice(2, 9);
}

function getPrimaryType(mime?: string | null) {
    if (!mime) return '';
    const parts = mime.split('/');
    return parts[0] || '';
}

function formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 16);
}

const filteredAssets = computed(() => {
    const want = form.value.contentType === 'image' ? 'image' : 'video';
    return assets.value.filter(asset => getPrimaryType(((asset as any).blob as Blob).type) === want);
});

const filteredInsertAssets = computed(() => {
    const want = form.value.insertAssetType;
    return assets.value.filter(asset => getPrimaryType(((asset as any).blob as Blob).type) === want);
});

const mainUploadEntry = computed(() => {
    return (form.value.uploadFiles || []).find(e => e.tempId === form.value.contentId) || null;
});

const processedHtml = computed(() => {
    if (!form.value.htmlString) return '';
    let html = form.value.htmlString;
    const assetRegex = /\{\{asset:(image|video):([^}]+)\}\}/g;
    html = html.replace(assetRegex, (match: string, type: string, assetId: string) => {
        const url = assetMap.value.get(assetId);
        if (!url) return match;
        if (type === 'image') {
            return `<img src="${url}" alt="asset" />`;
        } else if (type === 'video') {
            return `<video src="${url}" controls autoplay></video>`;
        }
        return match;
    });
    return html;
});

watch(() => form.value.htmlString, async (newHtml) => {
    if (!newHtml) return;
    const assetIds: string[] = [];
    const assetRegex = /\{\{asset:(image|video):([^}]+)\}\}/g;
    let match: RegExpExecArray | null = null;
    while ((match = assetRegex.exec(newHtml)) !== null) {
        assetIds.push(match[2]);
    }
    for (const id of assetIds) {
        if (!assetMap.value.has(id)) {
            try {
                const asset = await assetService.getAssetById(id);
                if (asset && (asset as any).blob) {
                    try {
                        const url = URL.createObjectURL((asset as any).blob);
                        createdUrls.push(url);
                        assetMap.value.set(id, url);
                    } catch (err) {
                        console.error('Failed to create object URL for asset', err);
                    }
                }
            } catch (e) {
                console.error('Failed to load asset:', id, e);
            }
        }
    }
}, { deep: true });

watch(() => props.event, (newEvent) => {
    const e = newEvent ?? ShowContentEvent.createEmpty();
    form.value = entityToForm(e);
    isEdit.value = !!newEvent;
});

function onClose() {
    emit('close');
}

async function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
        alert('開始時間が終了時間より後です。');
        return;
    }

    const register = new ContentDisplayEventRegister(assetService, container.resolve(ScheduleEventService));
    try {
        await register.register({
            startTime,
            endTime,
            contentType: form.value.contentType,
            contentId: form.value.contentId,
            htmlString: form.value.htmlString,
            fadeOutDuration: form.value.fadeOutDuration,
            displayMode: form.value.displayMode,
            effect: form.value.effect,
            duration: form.value.duration,
            fadeInTime: form.value.fadeInTime,
            fadeOutTime: form.value.fadeOutTime,
            scrollDirection: form.value.scrollDirection,
            uploadFiles: form.value.uploadFiles,
            existingEvent: props.event,
        });

        emit('saved');
        emit('close');
        return;
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
        return;
    }
}

function onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] || null;
    if (!file) return;
    if (!form.value.uploadFiles) form.value.uploadFiles = [];
    const existingIndex = form.value.uploadFiles.findIndex((e: any) => e.tempId === form.value.contentId);
    if (existingIndex !== -1) {
        const prev = form.value.uploadFiles[existingIndex];
        const prevUrl = assetMap.value.get(prev.tempId);
        if (prevUrl) {
            try { URL.revokeObjectURL(prevUrl); } catch (e) { }
            assetMap.value.delete(prev.tempId);
        }
        form.value.uploadFiles.splice(existingIndex, 1);
    }
    const tempId = generateTempId();
    try {
        const url = URL.createObjectURL(file);
        createdUrls.push(url);
        assetMap.value.set(tempId, url);
    } catch (err) {
        console.error('Failed to create object URL for main file', err);
    }
    // queue as a regular upload entry and mark this tempId as the contentId (so it will
    // be replaced with real id after upload)
    form.value.uploadFiles.push({ tempId, file });
    form.value.contentId = tempId;
}

const fileInput = ref<HTMLInputElement | null>(null);

const htmlTextarea = ref<HTMLTextAreaElement | null>(null);

const insertFileInput = ref<HTMLInputElement | null>(null);

function openFilePicker() {
    fileInput.value?.click();
}

function clearFile() {
    if (form.value.uploadFiles) {
        const idx = form.value.uploadFiles.findIndex(e => e.tempId === form.value.contentId);
        if (idx !== -1) {
            const ent = form.value.uploadFiles[idx];
            const url = assetMap.value.get(ent.tempId);
            if (url) {
                try { URL.revokeObjectURL(url); } catch (e) { }
                assetMap.value.delete(ent.tempId);
            }
            form.value.uploadFiles.splice(idx, 1);
        }
    }
    // clear primary contentId when main file cleared
    form.value.contentId = '';
    if (fileInput.value) fileInput.value.value = '';
}

async function insertAsset() {
    if (form.value.assetInsertSource === 'existing' && form.value.insertAssetId) {
        insertAtCursor(`{{asset:${form.value.insertAssetType}:${form.value.insertAssetId}}}`);
    }
}


onUnmounted(() => {
    createdUrls.forEach(u => {
        try { URL.revokeObjectURL(u); } catch (e) { }
    });
});

function onInsertFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] || null;
    if (!file) return;
    const type = form.value.insertAssetType || 'image';
    if (!form.value.uploadFiles) form.value.uploadFiles = [];
    const tempId = generateTempId();
    // insert placeholder into textarea
    insertAtCursor(`{{asset:${type}:${tempId}}}`);
    // create preview URL
    try {
        const url = URL.createObjectURL(file);
        createdUrls.push(url);
        assetMap.value.set(tempId, url);
    } catch (err) {
        console.error('Failed to create preview URL for insert file', err);
    }
    // queue for upload on submit
    form.value.uploadFiles.push({ tempId, file });
    // clear the input value so selecting the same file again works
    try { target.value = ''; } catch (e) { }
}

function openInsertFilePicker() {
    insertFileInput.value?.click?.();
}

function insertAtCursor(text: string) {
    if (!htmlTextarea.value) return;
    const textarea = htmlTextarea.value;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = form.value.htmlString.substring(0, start);
    const after = form.value.htmlString.substring(end);
    form.value.htmlString = before + text + after;
    textarea.focus();
    textarea.setSelectionRange(start + text.length, start + text.length);
}
</script>

<style scoped>
.modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #232323;
    color: #fff;
    padding: 2em;
    border-radius: 10px;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 600px;
    width: 90%;
    max-height: 80vh;
    overflow-y: auto;
}

.modal-content h3 {
    margin-bottom: 1em;
    color: #8fd3ff;
}

.form-group {
    margin-bottom: 1em;
}

.form-group label {
    display: block;
    margin-bottom: 0.5em;
    color: #fff;
}

.form-group input,
.form-group select,
.form-group textarea {
    width: 100%;
    padding: 0.5em;
    background: #333;
    color: #fff;
    border: 1px solid #666;
    border-radius: 6px;
}

.form-group textarea {
    min-height: 100px;
}

.form-actions {
    margin-top: 1em;
    display: flex;
    gap: 1.2em;
    justify-content: flex-end;
}

.main-btn {
    font-size: inherit;
    font-weight: 600;
    padding: 0.8em 2em;
    background: linear-gradient(90deg, #222 0%, #2a2a2a 100%);
    color: #fff;
    border: none;
    border-radius: 12px;
    cursor: pointer;
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.25);
    transition: background 0.18s, transform 0.12s, box-shadow 0.18s;
    outline: none;
}

.radio-group {
    display: flex;
    gap: 1em;
}

.radio-group label {
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: #fff;
}

.radio-group {
    flex-wrap: nowrap;
    white-space: nowrap;
    overflow: auto;
}

.file-picker {
    display: flex;
    align-items: center;
    gap: 0.6em;
}

.hidden-file-input {
    display: none;
}

.file-btn {
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    border: none;
    border-radius: 8px;
    padding: 0.5em 0.9em;
    cursor: pointer;
    font-weight: 600;
}

.file-name {
    color: #ddd;
    font-size: 0.95em;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.clear-btn {
    background: transparent;
    color: #fff;
    border: 1px solid #444;
    border-radius: 6px;
    padding: 0 0.5em;
    cursor: pointer;
}

.asset-insert-section {
    border: 1px solid #666;
    border-radius: 6px;
    padding: 0.5em;
    margin-top: 0.5em;
}

.asset-insert-controls {
    display: flex;
    gap: 0.5em;
    align-items: center;
    margin-top: 0.5em;
}

.html-preview {
    border: 1px solid #666;
    border-radius: 6px;
    padding: 0.5em;
    background: #333;
    color: #fff;
    max-height: 200px;
    overflow-y: auto;
}
</style>