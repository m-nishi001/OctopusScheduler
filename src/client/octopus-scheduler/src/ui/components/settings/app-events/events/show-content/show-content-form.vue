<template>
    <div v-bind="$attrs">
        <div class="form-group">
            <label>コンテンツタイプ:</label>
            <select v-model="formData.contentType">
                <option value="image">画像</option>
                <option value="movie">動画</option>
                <option value="html">HTML</option>
            </select>
        </div>

        <!-- Image Selection -->
        <div v-if="formData.contentType === 'image'" class="form-group">
            <label>画像:</label>
            <div class="content-selection">
                <select v-model="formData.contentId">
                    <option value="">選択してください</option>
                    <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">
                        {{ asset.name || asset.id }}
                    </option>
                </select>
                <button type="button" @click="triggerFileUpload" class="upload-button">+</button>
                <button type="button" @click="togglePreview" class="preview-button"
                    :disabled="!formData.contentId && !formData.contentFile">
                    ▶️
                </button>
            </div>
            <input type="file" accept="image/*" @change="handleFileUpload" ref="fileInput" style="display: none;">
        </div>

        <!-- Movie Selection -->
        <div v-else-if="formData.contentType === 'movie'" class="form-group">
            <label>動画:</label>
            <div class="content-selection">
                <select v-model="formData.contentId">
                    <option value="">選択してください</option>
                    <option v-for="asset in videoAssets" :key="asset.id" :value="asset.id">
                        {{ asset.name || asset.id }}
                    </option>
                </select>
                <button type="button" @click="triggerFileUpload" class="upload-button">+</button>
                <button type="button" @click="togglePreview" class="preview-button"
                    :disabled="!formData.contentId && !formData.contentFile">
                    ▶️
                </button>
            </div>
            <input type="file" accept="video/*" @change="handleFileUpload" ref="fileInput" style="display: none;">
        </div>

        <!-- HTML Input -->
        <div v-else-if="formData.contentType === 'html'" class="form-group">
            <label>HTMLコンテンツ:</label>
            <textarea v-model="formData.htmlContent" placeholder="HTMLを入力してください" rows="10"></textarea>
            <div class="html-actions">
                <select v-model="selectedImageForHtml">
                    <option value="">画像を選択</option>
                    <optgroup label="既存画像">
                        <option v-for="asset in imageAssets" :key="'existing-' + asset.id"
                            :value="'existing-' + asset.id">
                            {{ asset.name || asset.id }}
                        </option>
                    </optgroup>
                    <optgroup label="新規アップロード画像">
                        <option v-for="(file, index) in uploadedImages" :key="'uploaded-' + index"
                            :value="'uploaded-' + index">
                            {{ file.name }}
                        </option>
                    </optgroup>
                </select>
                <button type="button" @click="triggerImageUploadForHtml" class="upload-button">+</button>
                <button type="button" @click="insertImageIntoHtml" :disabled="!selectedImageForHtml">画像挿入</button>
                <button type="button" @click="togglePreview" class="preview-button">▶️</button>
            </div>
            <input type="file" accept="image/*" @change="handleImageUploadForHtml" ref="imageFileInput"
                style="display: none;">
        </div>

        <!-- Preview Dialog -->
        <div v-if="showPreviewDialog" class="modal-overlay" @click.self="closePreview">
            <div class="modal-content">
                <div v-if="previewType === 'image'">
                    <img :src="previewContent.url" alt="preview" style="max-width:80vw;max-height:70vh" />
                </div>
                <div v-else-if="previewType === 'movie'">
                    <video :src="previewContent.url" controls style="max-width:80vw;max-height:70vh" />
                </div>
                <div v-else-if="previewType === 'html'">
                    <div v-html="previewContent"></div>
                </div>
                <button class="close-btn" @click="closePreview">閉じる</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { reactive, ref, onMounted, onBeforeUnmount, watch } from 'vue';
import type { ShowContentFormData, EditShowContentFormData } from '../../app-events/types';
import { container } from 'tsyringe';
import { AssetService } from '../../../../../../model/applications/assets/asset-service';
import type { Asset } from '../../../../model/domains/assets/entity/asset';

type Props = { initialData?: ShowContentFormData | EditShowContentFormData }

const props = defineProps<Props>();
const emit = defineEmits<{ save: [ShowContentFormData | EditShowContentFormData] }>();

const assetService = container.resolve(AssetService);
const imageAssets = ref<Asset[]>([]);
const videoAssets = ref<Asset[]>([]);
const fileInput = ref<HTMLInputElement>();
const imageFileInput = ref<HTMLInputElement>();

const formData = reactive({
    contentType: props.initialData?.contentType ?? 'image',
    contentId: props.initialData?.contentId ?? '',
    htmlContent: props.initialData?.htmlContent ?? '',
    contentFile: null as File | null,
});

const selectedImageForHtml = ref('');
const uploadedImages = ref<File[]>([]);
const showPreviewDialog = ref(false);
const previewContent = ref<any>(null);
const previewType = ref('');

const refreshAssets = async () => {
    try {
        const assets = await assetService.getAssets();
        imageAssets.value = assets.filter(asset => asset.blob.type.startsWith('image/'));
        videoAssets.value = assets.filter(asset => asset.blob.type.startsWith('video/'));
    } catch (error) {
        console.error('Failed to load assets:', error);
    }
};
let assetsUpdatedHandler: ((ev: Event) => void) | null = null;

onMounted(async () => {
    await refreshAssets();

    // assign handler defined in outer scope and register it
    assetsUpdatedHandler = (ev: Event) => {
        const ce = ev as CustomEvent;
        setTimeout(async () => {
            await refreshAssets();
            const added: string[] | undefined = ce?.detail?.added;
            if (Array.isArray(added) && added.length > 0) {
                for (const id of added) {
                    const found = (formData.contentType === 'image' ? imageAssets.value : videoAssets.value)
                        .find(a => a.id === id);
                    if (found) {
                        if (!formData.contentId) formData.contentId = id;
                        break;
                    }
                }
            }
        }, 0);
    };
    window.addEventListener('assets:updated', assetsUpdatedHandler as EventListener);
});

onBeforeUnmount(() => { if (showPreviewDialog.value) { try { closePreview(); } catch { } } });

// Ensure event listener is removed when component unmounts (registered during setup)
onBeforeUnmount(() => {
    if (assetsUpdatedHandler) {
        try { window.removeEventListener('assets:updated', assetsUpdatedHandler as EventListener); } catch { }
        assetsUpdatedHandler = null;
    }
});

const handleFileUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    if (formData.contentId) {
        const assets = formData.contentType === 'image' ? imageAssets.value : videoAssets.value;
        const existingAsset = assets.find(a => a.id === formData.contentId);
        if (existingAsset && (existingAsset as any).uploaded) {
            try { await assetService.deleteAssets([formData.contentId]); } catch (error) { console.error('Failed to delete previous asset:', error); }
        }
    }

    try {
        const asset: Asset = { id: '', blob: file, name: file.name, uploadedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), size: file.size, uploaded: true };
        const addedIds = await assetService.addAssets([asset]);
        if (addedIds.length > 0) {
            formData.contentId = addedIds[0];
            const assets = await assetService.getAssets();
            imageAssets.value = assets.filter(asset => asset.blob.type.startsWith('image/'));
            videoAssets.value = assets.filter(asset => asset.blob.type.startsWith('video/'));
        }
    } catch (error) { console.error('Failed to upload content:', error); }
};

const triggerFileUpload = () => { fileInput.value?.click(); };

const togglePreview = () => {
    if (formData.contentType === 'html') { previewContent.value = formData.htmlContent; previewType.value = 'html'; }
    else {
        if (formData.contentFile) { const url = URL.createObjectURL(formData.contentFile); previewContent.value = { url }; previewType.value = formData.contentType; }
        else if (formData.contentId) {
            const asset = (formData.contentType === 'image' ? imageAssets.value : videoAssets.value).find(a => a.id === formData.contentId);
            if (asset) { const url = URL.createObjectURL(asset.blob); previewContent.value = { url }; previewType.value = formData.contentType; }
        }
    }
    showPreviewDialog.value = true;
};

const closePreview = () => { showPreviewDialog.value = false; if (previewContent.value?.url && previewContent.value.url.startsWith('blob:')) URL.revokeObjectURL(previewContent.value.url); previewContent.value = null; previewType.value = ''; };

const triggerImageUploadForHtml = () => { imageFileInput.value?.click(); };

const handleImageUploadForHtml = async (event: Event) => {
    const target = event.target as HTMLInputElement; const file = target.files?.[0]; if (!file) return;
    try { const asset: Asset = { id: '', blob: file, name: file.name, uploadedAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), size: file.size, uploaded: true }; const addedIds = await assetService.addAssets([asset]); if (addedIds.length > 0) { uploadedImages.value.push(file); selectedImageForHtml.value = 'uploaded-' + (uploadedImages.value.length - 1); const assets = await assetService.getAssets(); imageAssets.value = assets.filter(asset => asset.blob.type.startsWith('image/')); } } catch (error) { console.error('Failed to upload image for HTML:', error); }
};

const insertImageIntoHtml = () => {
    if (!selectedImageForHtml.value) return;
    let url = ''; let alt = '';
    if (selectedImageForHtml.value.startsWith('existing-')) {
        const assetId = selectedImageForHtml.value.replace('existing-', '');
        const asset = imageAssets.value.find(a => a.id === assetId);
        if (asset) { url = URL.createObjectURL(asset.blob); alt = asset.name || asset.id; }
    } else if (selectedImageForHtml.value.startsWith('uploaded-')) {
        const index = parseInt(selectedImageForHtml.value.replace('uploaded-', ''));
        const file = uploadedImages.value[index]; if (file) { url = URL.createObjectURL(file); alt = file.name; }
    }
    if (url) { const imgTag = `<img src="${url}" alt="${alt}" />`; formData.htmlContent += imgTag; selectedImageForHtml.value = ''; }
};

const save = async () => {
    let outBase: ShowContentFormData;
    if (formData.contentType === 'html') outBase = { actionType: 'ShowContentEvent', contentType: 'html', contentId: '', htmlContent: formData.htmlContent };
    else outBase = { actionType: 'ShowContentEvent', contentType: formData.contentType as 'image' | 'movie', contentId: formData.contentId, htmlContent: undefined };
    if (props.initialData && 'eventId' in props.initialData) { const out: EditShowContentFormData = { ...(outBase as any), eventId: (props.initialData as EditShowContentFormData).eventId }; emit('save', out); } else { emit('save', outBase); }
};

const reset = () => {
    formData.contentType = props.initialData?.contentType ?? 'image';
    formData.contentId = props.initialData?.contentId ?? '';
    formData.htmlContent = props.initialData?.htmlContent ?? '';
    formData.contentFile = null;
    selectedImageForHtml.value = '';
    uploadedImages.value = [];
};

watch(() => props.initialData, () => {
    reset();
});

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
    border: 1px solid #555;
    border-radius: 4px;
    background: #444;
    color: #fff;
}

.content-selection {
    display: flex;
    gap: 10px;
    align-items: center;
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

.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.modal-content {
    background: #232b36;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    max-width: 80vw;
    max-height: 80vh;
    overflow: auto;
    position: relative;
}

.close-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: #666;
    color: #fff;
    border: none;
    border-radius: 4px;
    padding: 5px 10px;
    cursor: pointer;
}
</style>
