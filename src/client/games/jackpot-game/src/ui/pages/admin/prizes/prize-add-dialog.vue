<template>
    <div class="modal-overlay">
        <div class="modal-content wide-modal">
            <div class="dialog-grid">
                <div class="dialog-main">
                    <h3>🎁 新しい景品を追加</h3>

                    <div class="field-grid">
                        <FieldText class="name-block" v-model="newPrizeName" label="名前" placeholder="景品名" />

                        <FieldNumberStepper class="rank-block" v-model="newPrizeRank" :min="1" label="景品ランク" />

                        <div class="field-block span-2 image-field-block">
                            <label class="field-label">画像1</label>
                            <div class="image-mode">
                                <div class="image-radio-group">
                                    <label><input type="radio" v-model="newImageMode" value="upload" /> アップロード</label>
                                    <label><input type="radio" v-model="newImageMode" value="select" /> 既存から選択</label>
                                </div>
                                <div class="image-select-group">
                                    <select v-if="newImageMode === 'select'" v-model="newImageAssetId" class="admin-input">
                                        <option value="">選択なし</option>
                                        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                                    </select>
                                    <input v-if="newImageMode === 'upload'" type="file" @change="onNewImageChange" accept="image/*" class="admin-input" />
                                    <span v-if="newImageMode === 'upload' && newImageFilename" class="file-name">{{ newImageFilename }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="field-block span-2 image-field-block">
                            <label class="field-label">画像2</label>
                            <div class="image-mode">
                                <div class="image-radio-group">
                                    <label><input type="radio" v-model="newImage2Mode" value="upload" /> アップロード</label>
                                    <label><input type="radio" v-model="newImage2Mode" value="select" /> 既存から選択</label>
                                </div>
                                <div class="image-select-group">
                                    <select v-if="newImage2Mode === 'select'" v-model="newImage2AssetId" class="admin-input">
                                        <option value="">選択なし</option>
                                        <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                                    </select>
                                    <input v-if="newImage2Mode === 'upload'" type="file" @change="onNewImage2Change" accept="image/*" class="admin-input" />
                                    <span v-if="newImage2Mode === 'upload' && newImage2Filename" class="file-name">{{ newImage2Filename }}</span>
                                </div>
                            </div>
                        </div>

                        <FieldSelect class="animation-block" v-model="newPrizeAnimation" :options="[{ value:'roulette', label:'ルーレット'}, { value:'slot', label:'スロット'}]" label="抽選アニメーション" />

                        <div class="field-block span-2 bgm-block">
                            <label class="field-label">BGM1</label>
                            <div class="bgm-mode">
                                <div class="bgm-radio-group">
                                    <label><input type="radio" v-model="newBgm1Mode" value="upload" /> アップロード</label>
                                    <label><input type="radio" v-model="newBgm1Mode" value="select" /> 既存から選択</label>
                                </div>
                                <div class="bgm-select-group">
                                    <select v-if="newBgm1Mode === 'select'" v-model="newBgm1AssetId" class="admin-input">
                                        <option value="">選択なし</option>
                                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                                    </select>
                                    <input v-if="newBgm1Mode === 'upload'" type="file" @change="onNewBgm1Change" accept="audio/*" class="admin-input" />
                                    <span v-if="newBgm1Mode === 'upload' && newBgm1Filename" class="file-name">{{ newBgm1Filename }}</span>
                                </div>
                            </div>
                        </div>

                        <div class="field-block span-2 bgm-block">
                            <label class="field-label">BGM2</label>
                            <div class="bgm-mode">
                                <div class="bgm-radio-group">
                                    <label><input type="radio" v-model="newBgm2Mode" value="upload" /> アップロード</label>
                                    <label><input type="radio" v-model="newBgm2Mode" value="select" /> 既存から選択</label>
                                </div>
                                <div class="bgm-select-group">
                                    <select v-if="newBgm2Mode === 'select'" v-model="newBgm2AssetId" class="admin-input">
                                        <option value="">選択なし</option>
                                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                                    </select>
                                    <input v-if="newBgm2Mode === 'upload'" type="file" @change="onNewBgm2Change" accept="audio/*" class="admin-input" />
                                    <span v-if="newBgm2Mode === 'upload' && newBgm2Filename" class="file-name">{{ newBgm2Filename }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- preview removed as requested -->
            </div>

            <div class="modal-footer">
                <div class="footer-left"></div>
                <div class="footer-right admin-modal-buttons">
                    <button class="admin-btn" @click="confirmAdd" :disabled="!newPrizeName.trim() || adding">追加</button>
                    <button class="admin-btn cancel-primary" @click="closeModal" :disabled="adding">キャンセル</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import FieldText from './components/field-text.vue';
import FieldNumberStepper from './components/field-number-stepper.vue';
import FieldSelect from './components/field-select.vue';
import { ref } from 'vue';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import { container } from 'tsyringe';
import type { Asset } from '@model/domains/drive-data/asset-data';

const props = defineProps({
    show: { type: Boolean, required: false },
    imageAssets: { type: Array as () => Asset[], required: true },
    audioAssets: { type: Array as () => Asset[], required: true },
});
const emit = defineEmits(['close', 'refresh']);

const assetDataService = container.resolve(AssetDataService);
const prizeService = container.resolve(PrizeService);

const newPrizeName = ref('');
const newPrizeRank = ref<number>(5);
const newPrizeAnimation = ref('roulette');
const newImageMode = ref('upload');
const newImageAssetId = ref('');
// newImageAsset is intentionally unused; asset uploads are handled via tempAsset
const newImageFilename = ref('');
const newImagePreview = ref('');
const newImage2Mode = ref('upload');
const newImage2AssetId = ref('');
const newImage2Filename = ref('');
const newImage2Preview = ref('');
const newBgm1AssetId = ref('');
const newBgm2AssetId = ref('');
const newBgm1Mode = ref('select');
const newBgm2Mode = ref('select');
const newBgm1Filename = ref('');
const newBgm2Filename = ref('');
const adding = ref(false);

const tempAsset = ref<Asset | null>(null);
const tempAsset2 = ref<Asset | null>(null);
const tempBgm1Asset = ref<Asset | null>(null);
const tempBgm2Asset = ref<Asset | null>(null);

const newImagePreviewUrl = ref<string | null>(null);
const newImage2PreviewUrl = ref<string | null>(null);

const closeModal = () => {
    // Reset form state and close
    emit('close');
    newPrizeName.value = '';
    newPrizeRank.value = 5;
    newImageAssetId.value = '';
    newImageFilename.value = '';
    newImagePreview.value = '';
    newImage2AssetId.value = '';
    newImage2Filename.value = '';
    newImage2Preview.value = '';
    newBgm1AssetId.value = '';
    newBgm2AssetId.value = '';
    newBgm1Mode.value = 'select';
    newBgm2Mode.value = 'select';
    newBgm1Filename.value = '';
    newBgm2Filename.value = '';
    tempAsset.value = null;
    tempAsset2.value = null;
    tempBgm1Asset.value = null;
    tempBgm2Asset.value = null;
};

const onNewImageChange = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetDataService.createDriveDataDtoFromFile(file);
        tempAsset.value = dto;
        newImageFilename.value = file.name;
        if (newImagePreviewUrl.value) {
            try { URL.revokeObjectURL(newImagePreviewUrl.value); } catch { }
            newImagePreviewUrl.value = null;
        }
        newImagePreviewUrl.value = URL.createObjectURL(file);
        newImagePreview.value = newImagePreviewUrl.value;
    }
};
const onNewImage2Change = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        const dto = await assetDataService.createDriveDataDtoFromFile(file);
        tempAsset2.value = dto;
        newImage2Filename.value = file.name;
        if (newImage2PreviewUrl.value) {
            try { URL.revokeObjectURL(newImage2PreviewUrl.value); } catch { }
            newImage2PreviewUrl.value = null;
        }
        newImage2PreviewUrl.value = URL.createObjectURL(file);
        newImage2Preview.value = newImage2PreviewUrl.value;
    }
};
const onNewBgm1Change = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        tempBgm1Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
        newBgm1Filename.value = file.name;
    }
};
const onNewBgm2Change = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        tempBgm2Asset.value = await assetDataService.createDriveDataDtoFromFile(file);
        newBgm2Filename.value = file.name;
    }
};

const confirmAdd = async () => {
    await addPrize();
    closeModal();
};

const addPrize = async () => {
    if (!newPrizeName.value.trim()) return;
    adding.value = true;
    const newPrize: any = {
        id: String(Date.now()),
        name: newPrizeName.value,
        rank: newPrizeRank.value,
        animation: newPrizeAnimation.value || 'roulette',
        order: 0,
    };
    if (newImageMode.value === 'select' && newImageAssetId.value) {
        newPrize.imageAssetId = newImageAssetId.value;
    }
    if (newImage2Mode.value === 'select' && newImage2AssetId.value) {
        newPrize.image2AssetId = newImage2AssetId.value;
    }
    if (newBgm1Mode.value === 'select' && newBgm1AssetId.value) {
        newPrize.bgm1AssetId = newBgm1AssetId.value;
    }
    if (newBgm2Mode.value === 'select' && newBgm2AssetId.value) {
        newPrize.bgm2AssetId = newBgm2AssetId.value;
    }

    try {
        if (tempAsset.value) {
            const updated = await assetDataService.addAssetData([tempAsset.value]);
            const updatedAsset = updated[0];
            newPrize.imageAssetId = updatedAsset.id;
            tempAsset.value = null;
        }
        if (tempAsset2.value) {
            const updated2 = await assetDataService.addAssetData([tempAsset2.value]);
            const updatedAsset2 = updated2[0];
            newPrize.image2AssetId = updatedAsset2.id;
            tempAsset2.value = null;
        }
        if (tempBgm1Asset.value) {
            const updated = await assetDataService.addAssetData([tempBgm1Asset.value]);
            newPrize.bgm1AssetId = updated[0].id;
            tempBgm1Asset.value = null;
        }
        if (tempBgm2Asset.value) {
            const updated = await assetDataService.addAssetData([tempBgm2Asset.value]);
            newPrize.bgm2AssetId = updated[0].id;
            tempBgm2Asset.value = null;
        }

        await prizeService.savePrize(newPrize);
        emit('refresh');
    } catch (error) {
        console.error("Failed to add prize:", error);
    } finally {
        adding.value = false;
    }
};

</script>

<style scoped>
/* Modal appearance for the add dialog — ensure the dialog is opaque and styled
   consistently with edit dialog. Scoped so styles don't leak. */
.modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 32px; /* outer safe margin */
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
    width: min(75vw, 880px);
    margin: 0 auto;
    max-height: calc(100vh - 96px); /* keep vertical margin from viewport */
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

/* Keep preview in add dialog constrained like edit dialog */
.preview-box {
    width: 100%;
    max-width: 320px;
    aspect-ratio: 1 / 1;
    background: linear-gradient(135deg, #2a3137 0%, #343d4a 100%);
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    z-index: 1000;
    border: 2px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}

.preview-box.two-image-preview .preview-half {
    width: 50%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.preview-box.two-image-preview .preview-img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
    display: block;
}

.preview-placeholder {
    color: #9fb8db;
    font-size: 1.1rem;
    font-weight: 500;
}

.prize-name-input { width: 100%; }

/* New grid layout matching edit dialog for consistency */
.dialog-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 20px;
    align-items: start;
    margin-top: 8px;
    min-height: 0;
}
.dialog-main { display:flex; flex-direction:column; gap:12px; min-width:0; }
.field-grid { display:grid; grid-template-columns: 1fr minmax(120px, 180px) minmax(170px, 260px); gap:12px 20px; align-items:center; }
.field-block { min-width:0; }
.span-2 { grid-column: 1 / -1; }
.name-block { grid-column: 1 / 2; }
.rank-block { grid-column: 2 / 3; display:flex; justify-content:flex-start; }
.animation-block { grid-column: 3 / 4; display:flex; justify-content:flex-start; }
/* preview removed */

@media (max-width: 980px) {
    .dialog-grid { grid-template-columns: 1fr; }
    .field-grid { grid-template-columns: 1fr; }
}

/* Rank control styling similar to edit dialog: overlay buttons inside the input */
.rank-control { position: relative; display: block; width: 100%; }
.rank-input { width: 100%; text-align: center; padding-left: 40px; padding-right: 40px; }
.rank-control .admin-input { box-sizing: border-box; }
.rank-btn { width: 32px; height: 32px; border-radius: 6px; background: rgba(255,255,255,0.06); color: #fff; border: none; cursor: pointer; position: absolute; top: 50%; transform: translateY(-50%); }
.rank-btn.left { left: 8px; }
.rank-btn.right { right: 8px; }
.rank-btn:hover { background: rgba(255,255,255,0.09); }
.animation-select { width: 100%; min-width: 160px; }
</style>
