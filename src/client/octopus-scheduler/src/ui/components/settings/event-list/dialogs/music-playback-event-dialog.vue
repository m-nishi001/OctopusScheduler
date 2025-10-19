<template>
    <div class="modal-overlay">
        <div class="modal-content" @click.stop>
            <h3>{{ isEdit ? '音楽再生イベント編集' : '音楽再生イベント追加' }}</h3>
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
                <div class="form-group" v-if="form.assetSource === 'existing'">
                    <label for="selectedAsset">既存アセット</label>
                    <select id="selectedAsset" v-model="form.selectedAssetId" required>
                        <option value="">選択してください</option>
                        <option v-for="asset in filteredAssets" :key="asset.id" :value="asset.id">
                            {{ asset.name }}
                        </option>
                    </select>
                </div>
                <div class="form-group" v-if="form.assetSource === 'upload'">
                    <label for="uploadFile">アップロードファイル</label>
                    <div class="file-picker">
                        <input id="uploadFile" ref="fileInput" class="hidden-file-input" type="file"
                            @change="onFileChange" accept=".mp3,.wav,.ogg,.m4a" />
                        <button type="button" class="file-btn" @click.prevent="openFilePicker">Choose File</button>
                        <span class="file-name">{{ form.uploadFile ? form.uploadFile.name : 'No file chosen' }}</span>
                        <button v-if="form.uploadFile" type="button" class="clear-btn"
                            @click.prevent="clearFile">×</button>
                    </div>
                </div>
                <div class="form-group">
                    <label for="fadeOutDuration">フェードアウト時間 (秒)</label>
                    <input id="fadeOutDuration" type="number" v-model.number="form.fadeOutDuration" min="0"
                        step="0.1" />
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
import { ScheduleEventService } from '../../../../../model/applications/schedule-event/schedule-event-service';
import { PlayAudioEvent } from '../../../../../model/domains/schedule-event/play-audio/play-audio-event';
import type { Asset } from '../../../../../model/domains/assets/entity/asset';
// PlayAudioEventDto imported for runtime usage above

interface Props {
    event?: PlayAudioEvent;
}

const props = defineProps<Props>();

const emit = defineEmits<{
    saved: [];
    close: [];
}>();

const isEdit = ref(!!props.event);

const form = ref({
    startTime: props.event ? formatDateTime(props.event.startTime) : formatDateTime(new Date()),
    endTime: props.event ? formatDateTime(props.event.endTime) : formatDateTime(new Date(Date.now() + 60000)),
    audioId: props.event?.audioId || '',
    fadeOutDuration: props.event?.fadeOutDuration || 0,
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
            audioId: newEvent.audioId,
            fadeOutDuration: newEvent.fadeOutDuration || 0,
            assetSource: 'existing',
            selectedAssetId: newEvent.audioId || '',
            uploadFile: null,
        };
        isEdit.value = true;
    } else {
        form.value = {
            startTime: formatDateTime(new Date()),
            endTime: formatDateTime(new Date(Date.now() + 60000)),
            audioId: '',
            fadeOutDuration: 0,
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
    return assets.value.filter(asset => ((asset as any).blob as Blob).type.startsWith('audio'));
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

    let audioId = form.value.audioId;

    const scheduleEventService = container.resolve(ScheduleEventService);

    if (form.value.assetSource === 'existing') {
        audioId = form.value.selectedAssetId;
    } else if (form.value.assetSource === 'upload' && form.value.uploadFile) {
        try {
            const asset: any = {
                id: '',
                name: form.value.uploadFile.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: form.value.uploadFile.size,
                blob: form.value.uploadFile,
            };
            const ids = await assetService.addAssets([asset]);
            audioId = ids[0];
            // continue to persist event below
        } catch (e) {
            alert('アセットアップロードに失敗しました: ' + (e instanceof Error ? e.message : String(e)));
            return;
        }
    }

    // persist
    try {
        if (isEdit.value && props.event) {
            const updated = new PlayAudioEvent({
                id: props.event.id,
                startTime,
                endTime,
                audioId,
                fadeOutDuration: form.value.fadeOutDuration,
                processedAt: props.event.processedAt,
                registeredAt: props.event.registeredAt,
                updatedAt: new Date(),
            });
            await scheduleEventService.updateScheduleEvents([updated]);
        } else {
            const tempEvent = new PlayAudioEvent({
                id: '',
                startTime,
                endTime,
                audioId,
                fadeOutDuration: form.value.fadeOutDuration,
                processedAt: null,
                registeredAt: new Date(),
                updatedAt: new Date(),
            });
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

.main-btn:hover,
.main-btn:focus {
    background: linear-gradient(90deg, #2a2a2a 0%, #333 100%);
    box-shadow: 0 4px 18px rgba(0, 0, 0, 0.35);
    transform: translateY(-2px) scale(1.04);
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