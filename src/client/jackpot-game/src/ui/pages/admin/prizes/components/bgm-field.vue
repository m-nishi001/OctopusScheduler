<template>
    <div class="bgm-field">
        <div class="bgm-controls">
            <label class="field-label">{{ props.label }}</label>
            <div class="bgm-mode">
                <div class="bgm-radio-group">
                    <label><input type="radio" :name="props.label + '-mode'" :checked="props.mode === 'upload'"
                            value="upload" @change="onModeChange" /> アップロード</label>
                    <label><input type="radio" :name="props.label + '-mode'" :checked="props.mode === 'select'"
                            value="select" @change="onModeChange" /> 既存から選択</label>
                </div>
                <div class="bgm-select-group">
                    <CustomSelect v-if="props.mode === 'select'" :modelValue="props.assetId"
                        :options="props.assets.map(a => ({ value: a.id, label: a.name }))" :allowEmpty="true"
                        @update:modelValue="$emit('update:assetId', $event)" />
                    <input v-if="props.mode === 'upload'" type="file" @change="onFileChange" accept="audio/*"
                        class="admin-input" />
                    <span v-if="props.mode === 'upload' && props.filename" class="file-name">{{ props.filename }}</span>
                    <button type="button" class="play-icon" @click="onTogglePlay" :aria-pressed="isPlaying">
                        <span v-if="isPlaying">⏸</span>
                        <span v-else>▶</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CustomSelect from './custom-select.vue';
import type { Asset } from '@model/domains/drive-data/asset-data';
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { useAudio } from '@shared-composables/use-audio';

const props = defineProps<{
    label: string;
    mode: string;
    assetId: string;
    filename: string;
    assets: Asset[];
}>();

const emit = defineEmits<{
    'update:mode': [value: string];
    'update:assetId': [value: string];
    'file-change': [event: Event];
}>();

// Services
const assetService = container.resolve(AssetDataService);

// Local state for upload-mode file so we can preview/play it before upload
const uploadedFile = ref<File | null>(null);

// useAudio instance (local to this field) for playback in admin UI
const audio = useAudio({ mode: 'html-audio' });
const { load, play, stop, isPlaying, isLoading } = audio as any;

const onFileChange = (event: Event) => {
    const file = (event.target as HTMLInputElement).files?.[0] || null;
    if (file) uploadedFile.value = file;
    emit('file-change', event);
};

const onModeChange = (event: Event) => {
    const v = (event.target as HTMLInputElement | null)?.value;
    if (v !== undefined) emit('update:mode', v);
};

const onTogglePlay = async () => {
    try {
        if ((isPlaying as any).value) {
            await stop();
            return;
        }

        let source: string | Blob | null = null;

        if (props.mode === 'upload') {
            if (!uploadedFile.value) return; // nothing to play
            source = uploadedFile.value;
        } else {
            // select mode: try to find asset blob in provided assets first
            const id = props.assetId;
            if (!id) return;
            const local = props.assets?.find((a: any) => a.id === id);
            if (local && local.blob) {
                source = local.blob;
            } else {
                // fetch via AssetDataService as fallback
                try {
                    const fetched = await assetService.getAssetDataById(id);
                    if (fetched && fetched.blob) source = fetched.blob;
                    else {
                        // last resort: if assetId is a URL string, try it
                        if (typeof id === 'string' && (id.startsWith('http') || id.startsWith('blob:') || id.startsWith('data:'))) {
                            source = id;
                        } else {
                            console.warn('[BgmField] No blob found for asset id:', id);
                            return;
                        }
                    }
                } catch (e) {
                    console.warn('[BgmField] failed to fetch asset blob:', e);
                    return;
                }
            }
        }

        await stop();
        await load(source as any);
        await play();
    } catch (e) {
        console.error('[BgmField] play failed', e);
    }
};
</script>

<style scoped>
/* Styles copied from prize-edit-dialog.vue */
.bgm-field {
    display: flex;
    gap: 12px;
    align-items: flex-start;
}

.bgm-controls {
    flex: 1 1 auto;
}

.field-label {
    color: #dbeeff;
    font-weight: 600;
    font-size: 14px;
}

.admin-input {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 15px;
    color: #fff;
    transition: box-shadow .15s ease, border-color .15s ease;
}

.admin-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45) inset, 0 0 0 3px rgba(88, 156, 255, 0.06);
}

.bgm-mode {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.bgm-radio-group {
    display: flex;
    gap: 12px;
    flex-wrap: nowrap;
    align-items: center;
    overflow: visible;
}

.bgm-radio-group label {
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    margin-right: 8px;
}

.bgm-select-group {
    display: block;
}

.bgm-select-group .admin-input {
    width: 100%;
    min-width: 0;
}

.bgm-select-group input[type="file"] {
    max-width: 170px;
    width: auto;
    display: inline-block;
}

.bgm-select-group .file-name {
    max-width: calc(100% - 180px);
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
}

.play-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-left: 8px;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    color: #fff;
    border: 1px solid rgba(255, 255, 255, 0.06);
    cursor: pointer;
    font-size: 16px;
}

.play-icon:active {
    transform: translateY(1px);
}
</style>