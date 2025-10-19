<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? 'スライドショーイベント編集' : 'スライドショーイベント追加' }}</h3>
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
                    <label for="folderId">Google DriveフォルダID</label>
                    <input id="folderId" type="text" v-model="form.folderId" required />
                </div>
                <div class="form-group">
                    <label for="displayDuration">表示時間 (秒)</label>
                    <input id="displayDuration" type="number" v-model.number="form.displayDuration" min="1" required />
                </div>
                <div class="form-group">
                    <label for="transitionType">切替アクション</label>
                    <select id="transitionType" v-model="form.transitionType" required>
                        <option value="fade">フェード</option>
                        <option value="slide">スライド</option>
                    </select>
                </div>
                <div class="form-group" v-if="form.transitionType === 'slide'">
                    <label for="slideDirection">スライド方向</label>
                    <select id="slideDirection" v-model="form.slideDirection" required>
                        <option value="left">左</option>
                        <option value="right">右</option>
                        <option value="up">上</option>
                        <option value="down">下</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>BGM アセット</label>
                    <div class="bgm-list">
                        <div v-for="(bgm, index) in form.bgmList" :key="index" class="bgm-item">
                            <span>{{ bgm.name || bgm.id }}</span>
                            <button type="button" @click="removeBgm(index)" class="remove-btn">×</button>
                        </div>
                        <div class="add-bgm">
                            <label>アセットソース</label>
                            <div class="radio-group">
                                <label>
                                    <input type="radio" value="existing" v-model="newBgmSource" />
                                    既存アセットを選択
                                </label>
                                <label>
                                    <input type="radio" value="upload" v-model="newBgmSource" />
                                    新規アップロード
                                </label>
                            </div>
                            <div v-if="newBgmSource === 'existing'">
                                <select v-model="selectedBgmId">
                                    <option value="">選択してください</option>
                                    <option v-for="asset in filteredAudioAssets" :key="asset.id" :value="asset.id">
                                        {{ asset.name }}
                                    </option>
                                </select>
                                <button type="button" @click="addExistingBgm" class="add-btn">追加</button>
                            </div>
                            <div v-if="newBgmSource === 'upload'">
                                <div class="file-picker">
                                    <input ref="bgmFileInput" class="hidden-file-input" type="file"
                                        @change="onBgmFileChange" accept=".mp3,.wav,.ogg,.m4a" />
                                    <button type="button" class="file-btn" @click.prevent="openBgmFilePicker">Choose
                                        File</button>
                                    <span class="file-name">{{ newBgmFile ? newBgmFile.name : 'No file chosen' }}</span>
                                    <button v-if="newBgmFile" type="button" class="clear-btn"
                                        @click.prevent="clearBgmFile">×</button>
                                </div>
                                <button type="button" @click="addUploadBgm" class="add-btn">追加</button>
                            </div>
                        </div>
                    </div>
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
import { ScheduleEventService } from '../../../../../model/applications/schedule-event/schedule-event-service';
import { SlideshowEvent, SlideshowEventParams } from '../../../../../model/domains/schedule-event/slideshow/slideshow-event';

interface Props {
    event?: SlideshowEvent;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    saved: [];
    close: [];
}>();

const isEdit = ref(!!props.event);

function entityToForm(e: SlideshowEvent) {
    return {
        startTime: formatDateTime(e.startTime),
        endTime: formatDateTime(e.endTime),
        folderId: e.folderId ?? '',
        displayDuration: e.displayDuration ?? 5,
        transitionType: e.transitionType ?? 'fade',
        slideDirection: e.slideDirection ?? 'left',
        bgmIds: e.bgmIds.join(',') || '',
        bgmList: e.bgmIds.map((id: string) => ({ id, name: getAssetName(id) })),
    };
}

const initialEntity = props.event ?? SlideshowEvent.createEmpty();
const form = ref(entityToForm(initialEntity));

const newBgmSource = ref<'existing' | 'upload'>('existing');
const selectedBgmId = ref('');
const newBgmFile = ref<File | null>(null);
const assets = ref<Asset[]>([]);
const assetService = container.resolve(AssetService);

watch(() => props.event, (newEvent) => {
    const e = newEvent ?? SlideshowEvent.createEmpty();
    form.value = entityToForm(e);
    isEdit.value = !!newEvent;
});

onMounted(async () => {
    await loadAssets();
});

const filteredAudioAssets = computed(() => {
    return assets.value.filter(asset => ((asset as any).blob as Blob).type.startsWith('audio'));
});

function getAssetName(id: string): string {
    const asset = assets.value.find(a => a.id === id);
    return asset ? asset.name : id;
}

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

function removeBgm(index: number) {
    form.value.bgmList.splice(index, 1);
}

function addExistingBgm() {
    if (selectedBgmId.value) {
        const asset = assets.value.find(a => a.id === selectedBgmId.value);
        if (asset && !form.value.bgmList.some(b => b.id === asset.id)) {
            form.value.bgmList.push({ id: asset.id, name: asset.name });
        }
        selectedBgmId.value = '';
    }
}

async function addUploadBgm() {
    if (newBgmFile.value) {
        try {
            const asset: any = {
                id: '',
                name: newBgmFile.value.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: newBgmFile.value.size,
                blob: newBgmFile.value,
            };
            const ids = await assetService.addAssets([asset]);
            form.value.bgmList.push({ id: ids[0], name: asset.name });
            newBgmFile.value = null;
        } catch (e) {
            alert('アセットアップロードに失敗しました: ' + (e instanceof Error ? e.message : String(e)));
        }
    }
}

function onBgmFileChange(event: Event) {
    const target = event.target as HTMLInputElement;
    newBgmFile.value = target.files?.[0] || null;
}

const bgmFileInput = ref<HTMLInputElement | null>(null);

function openBgmFilePicker() {
    bgmFileInput.value?.click();
}

function clearBgmFile() {
    newBgmFile.value = null;
    if (bgmFileInput.value) bgmFileInput.value.value = '';
}

async function onSubmit() {
    const startTime = new Date(form.value.startTime);
    const endTime = new Date(form.value.endTime);
    if (startTime >= endTime) {
        alert('開始時間が終了時間より後です。');
        return;
    }
    const scheduleEventService = container.resolve(ScheduleEventService);
    try {
        const baseParams = {
            startTime,
            endTime,
            folderId: form.value.folderId,
            displayDuration: form.value.displayDuration,
            transitionType: form.value.transitionType,
            slideDirection: form.value.slideDirection,
            bgmIds: form.value.bgmList.map(b => b.id),
        } as const;

        if (props.event) {
            const params = new SlideshowEventParams({
                id: props.event.id,
                startTime: baseParams.startTime,
                endTime: baseParams.endTime,
                folderId: baseParams.folderId,
                displayDuration: baseParams.displayDuration,
                transitionType: baseParams.transitionType as any,
                slideDirection: baseParams.slideDirection as any,
                bgmIds: baseParams.bgmIds,
                processedAt: props.event.processedAt,
                registeredAt: props.event.registeredAt,
                updatedAt: new Date(),
            });
            const updated = SlideshowEvent.fromParams(params);
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            const params = new SlideshowEventParams({
                id: '',
                startTime: baseParams.startTime,
                endTime: baseParams.endTime,
                folderId: baseParams.folderId,
                displayDuration: baseParams.displayDuration,
                transitionType: baseParams.transitionType as any,
                slideDirection: baseParams.slideDirection as any,
                bgmIds: baseParams.bgmIds,
                processedAt: null,
                registeredAt: new Date(),
                updatedAt: new Date(),
            });
            const tempEvent = SlideshowEvent.fromParams(params);
            await scheduleEventService.addScheduleEvents([tempEvent]);
        }
        emit('saved');
        emit('close');
    } catch (e) {
        alert('保存に失敗しました: ' + (e instanceof Error ? e.message : String(e)));
    }
}

function onClose() {
    emit('close');
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

.main-btn:hover,
.main-btn:focus {
    background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px) scale(1.04);
}

.bgm-list {
    border: 1px solid #666;
    border-radius: 6px;
    padding: 0.5em;
    background: #333;
}

.bgm-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5em;
    background: #444;
    margin-bottom: 0.5em;
    border-radius: 4px;
}

.remove-btn {
    background: #ff6b6b;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 0.2em 0.5em;
    cursor: pointer;
}

.add-bgm {
    margin-top: 1em;
    padding-top: 1em;
    border-top: 1px solid #666;
}

.radio-group {
    display: flex;
    gap: 1em;
    margin-bottom: 0.5em;
}

.radio-group label {
    display: flex;
    align-items: center;
    gap: 0.5em;
    color: #fff;
}

.add-btn {
    background: #4f8cff;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.5em 1em;
    cursor: pointer;
    margin-top: 0.5em;
}

.file-picker {
    display: flex;
    align-items: center;
    gap: 0.6em;
    margin-bottom: 0.5em;
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