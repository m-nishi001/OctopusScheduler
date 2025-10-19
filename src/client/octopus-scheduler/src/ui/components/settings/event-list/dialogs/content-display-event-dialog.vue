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
                        <span class="file-name">{{ form.uploadFile ? form.uploadFile.name : 'No file chosen' }}</span>
                        <button v-if="form.uploadFile" type="button" class="clear-btn"
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
                                <span class="file-name">{{ form.insertFile ? form.insertFile.name : 'No file chosen'
                                    }}</span>
                                <button v-if="form.insertFile" type="button" class="clear-btn"
                                    @click.prevent="clearInsertFile">×</button>
                            </div>
                            <button type="button" @click="insertAsset" :disabled="!form.insertFile">挿入</button>
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
import { ref, watch, onMounted, computed, onUnmounted } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../../model/applications/assets/asset-service';
import type { Asset } from '../../../../../model/domains/assets/entity/asset';
import type { ShowContentEventDto } from '../../../../../model/applications/schedule-event/show-content-event/show-content-event-dto';

interface Props {
    event?: ShowContentEventDto;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    submit: [form: any];
    close: [];
}>();

const isEdit = ref(!!props.event);

const form = ref({
    startTime: props.event ? formatDateTime(props.event.startTime) : formatDateTime(new Date()),
    endTime: props.event ? formatDateTime(props.event.endTime) : formatDateTime(new Date(Date.now() + 60000)),
    contentType: props.event?.contentType || 'image',
    contentId: props.event?.contentId || '',
    htmlString: props.event?.htmlString || '',
    fadeOutDuration: props.event?.fadeOutDuration || 0,
    displayMode: props.event?.displayMode || 'fade',
    effect: props.event?.effect || 'fade',
    duration: props.event?.duration || 3,
    fadeInTime: props.event?.fadeInTime || 1,
    fadeOutTime: props.event?.fadeOutTime || 1,
    scrollDirection: props.event?.scrollDirection || 'up',
    assetSource: 'existing' as 'existing' | 'upload',
    selectedAssetId: '',
    uploadFile: null as File | null,
    assetInsertSource: 'existing' as 'existing' | 'upload',
    insertAssetType: 'image' as 'image' | 'video',
    insertAssetId: '',
    insertFile: null as File | null,
    tempAssets: [] as Asset[],
});

const assets = ref<Asset[]>([]);
const assetService = container.resolve(AssetService);

const assetMap = ref<Map<string, string>>(new Map());
const createdUrls: string[] = [];

const processedHtml = computed(() => {
    if (!form.value.htmlString) return '';
    let html = form.value.htmlString;
    const assetRegex = /\{\{asset:(image|video):([^}]+)\}\}/g;
    html = html.replace(assetRegex, (match, type, assetId) => {
        const dataUrl = assetMap.value.get(assetId);
        if (!dataUrl) return match;
        if (type === 'image') {
            return `<img src="${dataUrl}" alt="asset" />`;
        } else if (type === 'video') {
            return `<video src="${dataUrl}" controls autoplay></video>`;
        }
        return match;
    });
    return html;
});

watch(() => form.value.htmlString, async (newHtml) => {
    if (!newHtml) return;
    const assetIds = [];
    const assetRegex = /\{\{asset:(image|video):([^}]+)\}\}/g;
    let match;
    while ((match = assetRegex.exec(newHtml)) !== null) {
        assetIds.push(match[2]);
    }
    for (const id of assetIds) {
        if (!assetMap.value.has(id)) {
            try {
                const asset = await assetService.getAssetById(id);
                if (asset) {
                    let url = (asset as any).dataUrl as string | undefined;
                    if (!url && (asset as any).blob) {
                        try {
                            url = URL.createObjectURL((asset as any).blob);
                            createdUrls.push(url);
                        } catch (err) {
                            console.error('Failed to create object URL for asset', err);
                        }
                    }
                    if (url) assetMap.value.set(id, url);
                }
            } catch (e) {
                console.error('Failed to load asset:', id, e);
            }
        }
    }
}, { deep: true });

watch(() => props.event, (newEvent) => {
    if (newEvent) {
        form.value = {
            startTime: formatDateTime(newEvent.startTime),
            endTime: formatDateTime(newEvent.endTime),
            contentType: newEvent.contentType,
            contentId: newEvent.contentId || '',
            htmlString: newEvent.htmlString || '',
            fadeOutDuration: newEvent.fadeOutDuration || 0,
            displayMode: newEvent.displayMode || 'fade',
            effect: newEvent.effect || 'fade',
            duration: newEvent.duration || 3,
            fadeInTime: newEvent.fadeInTime || 1,
            fadeOutTime: newEvent.fadeOutTime || 1,
            scrollDirection: newEvent.scrollDirection || 'up',
            assetSource: 'existing',
            selectedAssetId: newEvent.contentId || '',
            uploadFile: null,
            assetInsertSource: 'existing',
            insertAssetType: 'image',
            insertAssetId: '',
            insertFile: null,
            tempAssets: [],
        };
        isEdit.value = true;
    } else {
        form.value = {
            startTime: formatDateTime(new Date()),
            endTime: formatDateTime(new Date(Date.now() + 60000)),
            contentType: 'image',
            contentId: '',
            htmlString: '',
            fadeOutDuration: 0,
            displayMode: 'fade',
            effect: 'fade',
            duration: 3,
            fadeInTime: 1,
            fadeOutTime: 1,
            scrollDirection: 'up',
            assetSource: 'existing',
            selectedAssetId: '',
            uploadFile: null,
            assetInsertSource: 'existing',
            insertAssetType: 'image',
            insertAssetId: '',
            insertFile: null,
            tempAssets: [],
        };
        isEdit.value = false;
    }
});

onMounted(async () => {
    await loadAssets();
});

const filteredAssets = computed(() => {
    const type = form.value.contentType === 'image' ? 'image' : 'video';
    return assets.value.filter(asset => asset.type === type);
});

const filteredInsertAssets = computed(() => {
    const type = form.value.insertAssetType;
    return assets.value.filter(asset => asset.type === type);
});

async function loadAssets() {
    try {
        assets.value = await assetService.getAssets(); // まずローカルストレージから取得して表示
        // バックグラウンドでGoogle Driveと同期
        assetService.syncAssets().then(async () => {
            assets.value = await assetService.getAssets(); // 同期後に再取得
        }).catch(e => console.error('Sync failed:', e));
    } catch (e) {
        console.error('Failed to load assets:', e);
    }
}

function formatDateTime(date: Date): string {
    return date.toISOString().slice(0, 16);
}

async function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
        alert('開始時間が終了時間より後です。');
        return;
    }

    let contentId = form.value.contentId;
    let htmlString = form.value.htmlString;

    // Upload temp assets and replace temp IDs in htmlString
    if (form.value.tempAssets.length > 0) {
        try {
            const ids = await assetService.addAssets(form.value.tempAssets);
            form.value.tempAssets.forEach((asset, index) => {
                const realId = ids[index];
                htmlString = htmlString.replace(new RegExp(`{{asset:(${asset.type}):${asset.id}}}`, 'g'), `{{asset:$1:${realId}}}`);
            });
        } catch (e) {
            alert('アセットアップロードに失敗しました: ' + (e instanceof Error ? e.message : String(e)));
            return;
        }
    }

    if (form.value.contentType === 'image' || form.value.contentType === 'movie') {
        if (form.value.assetSource === 'existing') {
            contentId = form.value.selectedAssetId;
        } else if (form.value.assetSource === 'upload' && form.value.uploadFile) {
            try {
                const asset: any = {
                    id: '',
                    type: form.value.contentType === 'image' ? 'image' : 'video',
                    name: form.value.uploadFile.name,
                    uploadedAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    size: form.value.uploadFile.size,
                    blob: form.value.uploadFile,
                };
                const ids = await assetService.addAssets([asset]);
                contentId = ids[0];
                emit('submit', {
                    ...form.value,
                    startTime,
                    endTime,
                    contentId,
                    htmlString,
                });
                emit('close');
                return;
            } catch (e) {
                alert('アセットアップロードに失敗しました: ' + (e instanceof Error ? e.message : String(e)));
                return;
            }
        }
    }

    emit('submit', {
        ...form.value,
        startTime,
        endTime,
        contentId,
        htmlString,
    });
    emit('close');
}

function onClose() {
    emit('close');
}

function onFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    form.value.uploadFile = target.files?.[0] || null;
}

const fileInput = ref<HTMLInputElement | null>(null);

const htmlTextarea = ref<HTMLTextAreaElement | null>(null);

const insertFileInput = ref<HTMLInputElement | null>(null);

function openFilePicker() {
    fileInput.value?.click();
}

function clearFile() {
    form.value.uploadFile = null;
    if (fileInput.value) fileInput.value.value = '';
}

function insertAsset() {
    if (form.value.assetInsertSource === 'existing' && form.value.insertAssetId) {
        insertAtCursor(`{{asset:${form.value.insertAssetType}:${form.value.insertAssetId}}}`);
    } else if (form.value.assetInsertSource === 'upload' && form.value.insertFile) {
        const asset: Asset = {
            id: '',
            type: form.value.insertAssetType,
            dataUrl: '',
            name: form.value.insertFile.name,
            uploadedAt: new Date().toISOString(),
            lastUpdated: new Date().toISOString(),
            size: form.value.insertFile.size,
        };
        // store blob and create object URL for preview
        asset.blob = form.value.insertFile as unknown as Blob;
        try {
            const url = URL.createObjectURL(form.value.insertFile as File);
            createdUrls.push(url);
            asset.dataUrl = url;
        } catch (err) {
            console.error('Failed to create object URL for insert asset', err);
        }
        form.value.tempAssets.push(asset);
        const tempId = `temp_${Date.now()}_${Math.random()}`;
        asset.id = tempId;
        insertAtCursor(`{{asset:${form.value.insertAssetType}:${tempId}}}`);
        if (asset.dataUrl) assetMap.value.set(tempId, asset.dataUrl);
    }
}


onUnmounted(() => {
    createdUrls.forEach(u => {
        try { URL.revokeObjectURL(u); } catch (e) { }
    });
});
function onInsertFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    form.value.insertFile = target.files?.[0] || null;
}

function openInsertFilePicker() {
    insertFileInput.value?.click();
}

function clearInsertFile() {
    form.value.insertFile = null;
    if (insertFileInput.value) insertFileInput.value.value = '';
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
    font-size: 1.05em;
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