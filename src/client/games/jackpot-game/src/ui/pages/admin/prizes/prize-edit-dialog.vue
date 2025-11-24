.rank-block input[type="number"] {
text-align: left !important;
justify-content: flex-start !important;
}
<template>
    <div class="modal-overlay">
        <div class="modal-content wide-modal prize-edit-dialog" @click.stop>
            <div class="dialog-grid">
                <div class="dialog-main">
                    <h3 class="dialog-title">景品詳細</h3>

                    <div class="field-grid">
                        <FieldText class="name-block" v-model="editName" label="名前" placeholder="景品名" />

                        <FieldNumberStepper class="rank-block" v-model="editRank" :min="1" label="景品ランク" />

                        <FieldSelect class="animation-block" v-model="editAnimation"
                            :options="[{ value: 'roulette', label: 'ルーレット' }, { value: 'slot', label: 'スロット' }]"
                            label="抽選アニメーション" />
                    </div>

                    <div class="image-row">
                        <ImageField label="画像1" v-model:mode="editImageMode" v-model:assetId="editImageAssetId"
                            :filename="editImageFilename" :preview="editImagePreview" :assets="imageAssets"
                            @file-change="onEditImageChange" />

                        <ImageField label="画像2" v-model:mode="editImage2Mode" v-model:assetId="editImage2AssetId"
                            :filename="editImage2Filename" :preview="editImage2Preview" :assets="imageAssets"
                            @file-change="onEditImage2Change" />
                    </div>

                    <div class="bgm-row">
                        <BgmField label="BGM1" v-model:mode="editBgm1Mode" v-model:assetId="editBgm1AssetId"
                            :filename="editBgm1Filename" :assets="audioAssets" @file-change="onEditBgm1Change" />

                        <BgmField label="BGM2" v-model:mode="editBgm2Mode" v-model:assetId="editBgm2AssetId"
                            :filename="editBgm2Filename" :assets="audioAssets" @file-change="onEditBgm2Change" />
                    </div>
                </div>

                <!-- preview removed as requested -->

            </div>

            <div class="modal-footer">
                <div class="footer-left"></div>
                <div class="footer-right admin-modal-buttons">
                    <button class="admin-btn" @click="saveEdit">保存</button>
                    <button class="admin-btn cancel-primary" @click="closeModal">キャンセル</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import FieldText from './components/field-text.vue';
import FieldNumberStepper from './components/field-number-stepper.vue';
import FieldSelect from './components/field-select.vue';
import ImageField from './components/image-field.vue';
import BgmField from './components/bgm-field.vue';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import { container } from 'tsyringe';
import type { Asset } from '@model/domains/drive-data/asset-data';

const props = defineProps({
    prize: { type: Object as () => any, required: true },
    imageAssets: { type: Array as () => Asset[], required: true },
    audioAssets: { type: Array as () => Asset[], required: true },
    objectUrlMap: { type: Object, required: true }
});
const emit = defineEmits(['close', 'refresh']);

const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);

const editName = ref('');
const editRank = ref<number>(5);
const editImageAssetId = ref('');
const editImagePreview = ref('');
const editImageMode = ref('upload');
const editImageFilename = ref('');
const editImage2AssetId = ref('');
const editImage2Mode = ref('upload');
const editImage2Filename = ref('');
const editImage2Preview = ref('');
const editBgm1AssetId = ref('');
const editBgm2AssetId = ref('');
const editBgm1Mode = ref('select');
const editBgm2Mode = ref('select');
const editBgm1Filename = ref('');
const editBgm2Filename = ref('');
const editAnimation = ref('roulette');

const editTempAsset = ref<Asset | null>(null);
const editTempAsset2 = ref<Asset | null>(null);
const editTempBgm1Asset = ref<Asset | null>(null);
const editTempBgm2Asset = ref<Asset | null>(null);

const editImagePreviewUrl = ref<string | null>(null);
const editImage2PreviewUrl = ref<string | null>(null);

onMounted(() => {
    if (props.prize) {
        loadPrize(props.prize);
    }
});

watch(() => props.prize, (val) => {
    if (val) loadPrize(val);
});

watch(() => editImageAssetId.value, (newId) => {
    if (newId) {
        editImagePreview.value = props.objectUrlMap.get(newId) || newId;
    } else {
        editImagePreview.value = '';
    }
});

watch(() => editImage2AssetId.value, (newId) => {
    if (newId) {
        editImage2Preview.value = props.objectUrlMap.get(newId) || newId;
    } else {
        editImage2Preview.value = '';
    }
});

const loadPrize = async (prize: any) => {
    editName.value = prize.name;
    editRank.value = prize.rank;
    editAnimation.value = prize.animation || 'roulette';
    if (editImagePreviewUrl.value) {
        try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
        editImagePreviewUrl.value = null;
    }
    if (prize.imageAssetId) {
        editImageMode.value = 'select';
        editImageAssetId.value = prize.imageAssetId;
        editImagePreview.value = props.objectUrlMap.get(prize.imageAssetId) || prize.imageAssetId;
    } else {
        editImageMode.value = 'upload';
    }
    editImageFilename.value = '';
    editTempAsset.value = null;

    if (prize.image2AssetId) {
        editImage2Mode.value = 'select';
        editImage2AssetId.value = prize.image2AssetId;
        editImage2Preview.value = props.objectUrlMap.get(prize.image2AssetId) || prize.image2AssetId;
    } else {
        editImage2Mode.value = 'upload';
    }
    editImage2Filename.value = '';
    editTempAsset2.value = null;

    if (prize.bgm1AssetId) {
        editBgm1Mode.value = 'select';
        editBgm1AssetId.value = prize.bgm1AssetId;
    } else {
        editBgm1Mode.value = 'upload';
    }
    if (prize.bgm2AssetId) {
        editBgm2Mode.value = 'select';
        editBgm2AssetId.value = prize.bgm2AssetId;
    } else {
        editBgm2Mode.value = 'upload';
    }
    editBgm1Filename.value = '';
    editBgm2Filename.value = '';
    editTempBgm1Asset.value = null;
    editTempBgm2Asset.value = null;
};

const closeModal = () => {
    emit('close');
};

const onEditImageChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetDataService.createDriveDataDtoFromFile(file);
        editTempAsset.value = dto;
        editImageFilename.value = file.name;
        if (editImagePreviewUrl.value) {
            try { URL.revokeObjectURL(editImagePreviewUrl.value); } catch { }
            editImagePreviewUrl.value = null;
        }
        editImagePreviewUrl.value = URL.createObjectURL(file);
        editImagePreview.value = editImagePreviewUrl.value;
    }
};
const onEditImage2Change = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetDataService.createDriveDataDtoFromFile(file);
        editTempAsset2.value = dto;
        editImage2Filename.value = file.name;
        if (editImage2PreviewUrl.value) {
            try { URL.revokeObjectURL(editImage2PreviewUrl.value); } catch { }
            editImage2PreviewUrl.value = null;
        }
        editImage2PreviewUrl.value = URL.createObjectURL(file);
        editImage2Preview.value = editImage2PreviewUrl.value;
    }
};
const onEditBgm1Change = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        editTempBgm1Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
        editBgm1Filename.value = file.name;
    }
};
const onEditBgm2Change = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        editTempBgm2Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
        editBgm2Filename.value = file.name;
    }
};

const saveEdit = async () => {
    if (!props.prize) return;
    let assetId: string | undefined;
    if (editTempAsset.value) {
        const updatedAssets = await assetDataService.addAssetData([editTempAsset.value]);
        const updatedAsset = updatedAssets[0];
        editTempAsset.value = updatedAsset;
        assetId = updatedAsset.id;
    }
    let bgm1AssetId: string | undefined;
    if (editTempBgm1Asset.value) {
        const updatedAssets = await assetDataService.addAssetData([editTempBgm1Asset.value]);
        editTempBgm1Asset.value = updatedAssets[0];
        bgm1AssetId = editTempBgm1Asset.value.id;
    }
    let bgm2AssetId: string | undefined;
    if (editTempBgm2Asset.value) {
        const updatedAssets = await assetDataService.addAssetData([editTempBgm2Asset.value]);
        editTempBgm2Asset.value = updatedAssets[0];
        bgm2AssetId = editTempBgm2Asset.value.id;
    }
    let image2AssetId: string | undefined;
    if (editTempAsset2.value) {
        const updatedAssets2 = await assetDataService.addAssetData([editTempAsset2.value]);
        editTempAsset2.value = updatedAssets2[0];
        image2AssetId = editTempAsset2.value.id;
    }

    const updatedPrize = {
        ...props.prize,
        name: editName.value,
        rank: editRank.value,
        animation: editAnimation.value,
        imageAssetId: assetId || editImageAssetId.value,
        image2AssetId: image2AssetId || editImage2AssetId.value,
        bgm1AssetId: bgm1AssetId || editBgm1AssetId.value,
        bgm2AssetId: bgm2AssetId || editBgm2AssetId.value,
    };
    try {
        await prizeService.updatePrize(updatedPrize.id, updatedPrize);
        emit('refresh');
        emit('close');
    } catch (error) {
        console.error("Failed to update prize:", error);
    }
};

const increaseRank = () => { editRank.value = (Number(editRank.value) || 0) + 1; };
const decreaseRank = () => { editRank.value = Math.max(1, (Number(editRank.value) || 1) - 1); };

</script>

<style scoped>
/* Modal appearance for the edit dialog — copied/adjusted so this component
   renders as a proper dialog (not transparent). Scoped so it doesn't affect
   other admin components. */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px;
    /* outer safe margin */
    z-index: 1100;
}

.modal-content {
    background: linear-gradient(135deg, #232b36 0%, #2a3441 100%);
    color: #fff;
    padding: 28px;
    border-radius: 16px;
    text-align: left;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
    max-width: 880px;
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-sizing: border-box;
}

.modal-content.wide-modal {
    width: min(86vw, 1100px);
    margin: 0 auto;
    max-width: 1100px;
    max-height: calc(100vh - 96px);
    /* keep vertical margin from viewport */
    display: flex;
    flex-direction: column;
}

.modal-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 20px;
    flex: 0 0 auto;
    padding-top: 20px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
}

/* Keep styling focused on the preview so large images can't expand the dialog.
   The global admin CSS defines general preview rules; here we enforce a fixed
   preview size for the edit dialog and make images contain inside the box. */
.preview-box.preview-box--small {
    width: 260px;
    height: 260px;
    max-width: 280px;
    min-width: 0;
    flex: 0 0 auto;
    aspect-ratio: unset;
}

.preview-box.preview-box--small .preview-half {
    width: 50%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: transparent;
}

.preview-box.preview-box--small .preview-img {
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    display: block;
}

.preview-box.preview-box--small .preview-placeholder {
    padding: 8px;
    text-align: center;
}

/* New grid-based layout: main form + optional preview aside. */
.dialog-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    align-items: start;
    margin-top: 8px;
    min-height: 0;
}

.dialog-main {
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
    /* allow children to shrink */
}

.field-grid {
    display: grid;
    /* three equal columns for name / rank / animation */
    grid-template-columns: repeat(3, 1fr);
    gap: 56px;

    /* Prevent overlap: ensure minimum width for name/rank fields */
    .name-block {
        min-width: 180px;
    }

    .rank-block {
        min-width: 120px;
    }

    align-items: start;
}

/* Ensure grid children don't overflow their cells and participate correctly
       in flex/shrink behavior. This prevents inputs or controls from visually
       overlapping neighbor columns. */
.field-grid>* {
    min-width: 0;
}

.field-grid .field-block {
    width: 100%;
    box-sizing: border-box;
}

.rank-animation-block {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    align-items: center;
}

.rank-animation-block>* {
    min-width: 0;
}

.rank-animation-block .field-block:first-child {
    width: 100px;
}

.field-block {
    display: block;
    min-width: 0;
    overflow: visible;
}

.field-block .field-label {
    display: block;
    margin-bottom: 8px;
    font-size: 15px;
}

/* Make animation select visually similar to the name input and fill the available column */
.animation-select {
    width: 100%;
    min-width: 160px;
}

.animation-block .admin-input {
    width: 100%;
}

/* preview removed */

/* Layout for image row: two columns */
.image-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    align-items: start;
}

/* Ensure select dropdown renders above preview cards and stays visually contained */
select.admin-input {
    position: relative;
    z-index: 60;
}

/* Style native option fallback for better contrast (may not apply in all browsers) */
select.admin-input option {
    background: #232b36;
    color: #fff;
}

/* Limit select dropdown's virtual height where possible (platform dependent) */
select.admin-input {
    max-height: 40px;
}

/* BGM row styling: two columns for BGM1 and BGM2 */
.bgm-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 18px;
    align-items: start;
}

/* Limit width of native file input (Choose File) so it doesn't touch previews */
.image-select-group input[type="file"],
.bgm-select-group input[type="file"] {
    max-width: 170px;
    width: auto;
    display: inline-block;
}

.image-select-group .file-name,
.bgm-select-group .file-name {
    max-width: calc(100% - 180px);
    display: inline-block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    vertical-align: middle;
}

/* truncate long file names so they don't break layout */
.file-name {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* Larger, lifted title */
.dialog-title {
    font-size: 22px;
    margin: 0 0 10px 0;
    transform: translateY(-6px);
    font-weight: 600;
}

/* Scale up inputs and buttons a bit to make the dialog feel larger */
.modal-content {
    font-size: 16px;
}

.admin-input {
    padding: 10px 14px;
    font-size: 15px;
}

.prize-name-input {
    width: 100%;
}

.admin-btn {
    padding: 10px 16px;
    font-size: 15px;
}

/* Visual polish */
.modal-content {
    background: linear-gradient(180deg, #222b33 0%, #2a333b 100%);
    border-radius: 14px;
    padding: 30px 34px;
}

.field-block {
    margin-top: 14px;
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
    transition: box-shadow .15s ease, border-color .15s ease;
}

.admin-input:focus {
    outline: none;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45) inset, 0 0 0 3px rgba(88, 156, 255, 0.06);
}

/* Apply same admin-input appearance to child components' inputs/selects
   Using deep selector so scoped styles propagate into nested components. */
:deep(.admin-input) {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 15px;
    color: #fff;
    transition: box-shadow .15s ease, border-color .15s ease;
}

:deep(.admin-input:focus) {
    outline: none;
    border-color: rgba(255, 255, 255, 0.16);
    box-shadow: 0 6px 18px rgba(0, 0, 0, 0.45) inset, 0 0 0 3px rgba(88, 156, 255, 0.06);
}

.image-preview,
.preview-box.preview-box--small {
    background: linear-gradient(180deg, #2f3a41, #293238);
    border-radius: 8px;
    box-shadow: 0 6px 16px rgba(0, 0, 0, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.04);
}

.image-preview img,
.preview-img {
    border-radius: 6px;
}


/* BGM/Image rows responsive behaviour */
@media (max-width: 980px) {
    .dialog-grid {
        grid-template-columns: 1fr;
    }

    .field-grid {
        grid-template-columns: 1fr;
    }

    .image-row,
    .bgm-row {
        grid-template-columns: 1fr;
    }
}

/* Footer buttons aligned right and styled */
.admin-modal-buttons {
    display: flex;
    gap: 16px;
    justify-content: flex-end;
}

.admin-btn {
    background: linear-gradient(180deg, #0f1720, #1b2328);
    color: #fff;
    border: none;
    border-radius: 10px;
}

.admin-btn.cancel-primary {
    background: rgba(255, 255, 255, 0.04);
}

/* Scrollbar subtle but visible when content overflows */
.dialog-main::-webkit-scrollbar {
    width: 10px;
}

.dialog-main::-webkit-scrollbar-track {
    background: transparent;
}

.dialog-main::-webkit-scrollbar-thumb {
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
}

/* Radio/select groups: prevent clipping and allow wrapping */

/* Make preview halves a bit larger */
.preview-box.preview-box--small .preview-half {
    padding: 6px;
}

/* Button spacing */
.admin-modal-buttons {
    display: flex;
    gap: 20px;
    align-items: center;
}

/* footer padding to avoid buttons hugging the edge */
.modal-footer {
    padding-right: 20px;
}

/* No !important overrides here: layout controlled by container grid and responsive rules. */
</style>
