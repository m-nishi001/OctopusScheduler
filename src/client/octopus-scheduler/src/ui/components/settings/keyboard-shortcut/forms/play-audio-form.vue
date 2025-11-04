<template>
    <div class="form-group">
        <label>音源:</label>
        <div class="audio-selection">
            <select v-model="formData.audioId">
                <option value="">選択してください</option>
                <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">
                    {{ asset.name || asset.id }}
                </option>
            </select>
            <button type="button" @click="triggerFileUpload" class="upload-button">+</button>
            <button type="button" @click="togglePreview" class="preview-button"
                :disabled="!formData.audioId && !formData.audioFile">
                {{ isPlaying ? '⏸️' : '▶️' }}
            </button>
        </div>
        <input type="file" accept="audio/*" @change="handleFileUpload" ref="fileInput" style="display: none;">
    </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { AssetService } from '../../../../../model/applications/assets/asset-service';
import type { Asset } from '../../../../../model/domains/assets/entity/asset';
import { useAudio } from '../../../../../../../packages/shared-composables/src/use-audio';

interface Props {
    initialData: { audioId?: string };
}

const props = defineProps<Props>();
const emit = defineEmits<{ save: [data: any] }>();

const assetService = container.resolve(AssetService);
const audioAssets = ref<Asset[]>([]);
const fileInput = ref<HTMLInputElement>();

const { load, play, pause, isPlaying } = useAudio({ mode: 'html-audio' });

const formData = reactive({
    audioId: props.initialData.audioId || '',
    audioFile: null as File | null,
});

onMounted(async () => {
    try {
        const assets = await assetService.getAssets();
        audioAssets.value = assets.filter(asset => asset.blob.type.startsWith('audio/'));
    } catch (error) {
        console.error('Failed to load audio assets:', error);
    }
});

const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    formData.audioFile = file;
    // Do not save immediately, wait for save button
};

const triggerFileUpload = () => {
    fileInput.value?.click();
};

const togglePreview = async () => {
    if (isPlaying.value) {
        pause();
    } else {
        let source: Blob | string | null = null;
        if (formData.audioFile) {
            source = formData.audioFile;
        } else if (formData.audioId) {
            const asset = audioAssets.value.find(a => a.id === formData.audioId);
            if (asset) {
                source = asset.blob;
            }
        }
        if (source) {
            await load(source);
            play();
        }
    }
};

const save = async () => {
    if (formData.audioFile) {
        try {
            const asset: Asset = {
                id: '', // Will be set by repository
                blob: formData.audioFile,
                name: formData.audioFile.name,
                uploadedAt: new Date().toISOString(),
                lastUpdated: new Date().toISOString(),
                size: formData.audioFile.size,
            };

            const addedIds = await assetService.addAssets([asset]);
            if (addedIds.length > 0) {
                formData.audioId = addedIds[0];
                // Refresh the list
                const assets = await assetService.getAssets();
                audioAssets.value = assets.filter(asset => asset.blob.type.startsWith('audio/'));
            }
        } catch (error) {
            console.error('Failed to upload audio:', error);
            return; // Do not emit if upload failed
        }
    }

    emit('save', { actionType: 'PlayAudioEvent', audioId: formData.audioId });
};

defineExpose({ save });
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
    border: 1px solid #555;
    border-radius: 4px;
    background: #444;
    color: #fff;
}

.audio-selection {
    display: flex;
    gap: 10px;
    align-items: center;
}

.audio-selection select {
    flex: 1;
}

.upload-button {
    padding: 8px 12px;
    border: 1px solid #555;
    border-radius: 4px;
    background: #666;
    color: #fff;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.upload-button:hover {
    background: #777;
}

.preview-button {
    padding: 8px 12px;
    border: 1px solid #555;
    border-radius: 4px;
    background: #666;
    color: #fff;
    cursor: pointer;
    font-size: 16px;
    width: 40px;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.preview-button:hover:not(:disabled) {
    background: #777;
}

.preview-button:disabled {
    background: #444;
    cursor: not-allowed;
}
</style>