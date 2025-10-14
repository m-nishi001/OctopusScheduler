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
                    <textarea id="htmlString" v-model="form.htmlString" required></textarea>
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
import { ref, watch, onMounted, computed } from 'vue';
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
});

const assets = ref<Asset[]>([]);
const assetService = container.resolve(AssetService);

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

async function loadAssets() {
    try {
        assets.value = await assetService.getAssets();
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

    if (form.value.contentType === 'image' || form.value.contentType === 'movie') {
        if (form.value.assetSource === 'existing') {
            contentId = form.value.selectedAssetId;
        } else if (form.value.assetSource === 'upload' && form.value.uploadFile) {
            try {
                const asset: Asset = {
                    id: '',
                    type: form.value.contentType === 'image' ? 'image' : 'video',
                    dataUrl: '',
                    name: form.value.uploadFile.name,
                    uploadedAt: new Date().toISOString(),
                    lastUpdated: new Date().toISOString(),
                    size: form.value.uploadFile.size,
                    referenceFrom: [],
                };
                const fileReader = new FileReader();
                fileReader.onload = async (e) => {
                    asset.dataUrl = e.target?.result as string;
                    const ids = await assetService.addAssets([asset]);
                    contentId = ids[0];
                    emit('submit', {
                        ...form.value,
                        startTime,
                        endTime,
                        contentId,
                    });
                    emit('close');
                };
                fileReader.readAsDataURL(form.value.uploadFile);
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

function openFilePicker() {
    fileInput.value?.click();
}

function clearFile() {
    form.value.uploadFile = null;
    if (fileInput.value) fileInput.value.value = '';
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
</style>