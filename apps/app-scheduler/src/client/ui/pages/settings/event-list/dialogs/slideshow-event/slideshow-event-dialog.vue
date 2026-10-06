<template>
    <UiDialog :model-value="true" :title="isEdit ? 'スライドショーイベント編集' : 'スライドショーイベント追加'" size="md" :close-on-overlay="false" @close="onClose">
        <form id="slideshow-form" @submit.prevent="onSubmit">
            <div class="form-group">
                <label for="startTime">開始時間</label>
                <input id="startTime" type="datetime-local" v-model="form.startTime" required />
            </div>
            <div class="form-group">
                <label for="endTime">終了時間</label>
                <input id="endTime" type="datetime-local" v-model="form.endTime" required />
            </div>
            <div class="form-group">
                <label for="folderId">フォルダ名 (assets 配下)</label>
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
                                <option v-for="asset in filteredAudioAssets" :key="asset.id" :value="asset.id">{{
                                    asset.name }}</option>
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
        </form>
        <template #footer>
            <UiButton @click="onClose">キャンセル</UiButton>
            <UiButton type="submit" variant="primary" form="slideshow-form">{{ isEdit ? '更新' : '追加' }}</UiButton>
        </template>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog } from '@octopus/ui-kit';
import { useSlideshowEvent } from './use-slideshow-event';
interface Props { event?: any }
const props = defineProps<Props>();
const emit = defineEmits<{ saved: []; close: [] }>();

const { form, isEdit, newBgmSource, selectedBgmId, newBgmFile, filteredAudioAssets, removeBgm, addExistingBgm, onBgmFileChange, bgmFileInput, openBgmFilePicker, clearBgmFile, addUploadBgm, onSubmit, onClose } = useSlideshowEvent(props, emit);
</script>

<style scoped>
.form-group textarea {
    min-height: 100px;
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

.add-bgm {
    margin-top: 1em;
    padding-top: 1em;
    border-top: 1px solid var(--ui-border, #3a4048);
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
    color: var(--ui-text, #fff);
}

.add-btn {
    background: var(--ui-accent, #aee1ff);
    color: var(--ui-text, #fff);
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
    background: var(--ui-accent, #aee1ff);
    color: var(--ui-accent-contrast, #12263a);
    border: none;
    border-radius: 8px;
    padding: 0.5em 0.9em;
    cursor: pointer;
    font-weight: 600;
}

.file-name {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.clear-btn {
    background: transparent;
    color: var(--ui-text, #fff);
    border: 1px solid var(--ui-border, #3a4048);
    border-radius: 6px;
    padding: 0 0.5em;
    cursor: pointer;
}
</style>
