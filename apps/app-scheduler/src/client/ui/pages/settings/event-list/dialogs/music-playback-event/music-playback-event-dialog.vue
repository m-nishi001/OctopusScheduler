<template>
    <UiDialog :model-value="true" :title="isEdit ? '音楽再生イベント編集' : '音楽再生イベント追加'" size="md" :close-on-overlay="false" @close="onClose">
        <form id="music-playback-form" @submit.prevent="onSubmit">
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
        </form>
        <template #footer>
            <UiButton @click="onClose">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="music-playback-form">{{ isEdit ? '更新' : '追加' }}</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { useMusicPlaybackEvent } from './use-music-playback-event';

interface Props { event?: any }
const props = defineProps<Props>();
const emit = defineEmits<{ saved: []; close: [] }>();

const { form, isEdit, filteredAssets, fileInput, openFilePicker, onFileChange, clearFile, onSubmit, onClose } = useMusicPlaybackEvent(props, emit);
</script>

<style scoped>
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
