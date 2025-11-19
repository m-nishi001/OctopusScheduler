<template>
    <div class="modal-overlay">
        <div class="modal-content wide-modal">
            <div class="add-modal-grid">
                <div class="add-form-column">
                    <h3>🎁 新しい景品を追加</h3>
                    <div class="field-block span-2">
                        <div class="two-col">
                            <div class="field-block">
                                <label class="field-label">名前</label>
                                <input v-model="newPrizeName" type="text" placeholder="景品名"
                                    class="admin-input prize-name-input" />
                            </div>
                            <div class="field-block">
                                <label class="field-label">景品ランク</label>
                                <input v-model.number="newPrizeRank" type="number" placeholder="景品ランク" min="1"
                                    class="admin-input" />
                            </div>
                        </div>
                    </div>

                    <div class="field-block span-2">
                        <label class="field-label">画像1</label>
                        <div class="image-mode">
                            <div class="image-radio-group">
                                <label><input type="radio" v-model="newImageMode" value="upload" /> アップロード</label>
                                <label><input type="radio" v-model="newImageMode" value="select" /> 既存から選択</label>
                            </div>
                            <div class="image-select-group">
                                <select v-if="newImageMode === 'select'" v-model="newImageAssetId" class="admin-input">
                                    <option value="">選択なし</option>
                                    <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name
                                        }}</option>
                                </select>
                                <input v-if="newImageMode === 'upload'" type="file" @change="onNewImageChange"
                                    accept="image/*" class="admin-input" />
                                <span v-if="newImageMode === 'upload' && newImageFilename" class="file-name">{{
                                    newImageFilename }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="field-block span-2">
                        <label class="field-label">画像2</label>
                        <div class="image-mode">
                            <div class="image-radio-group">
                                <label><input type="radio" v-model="newImage2Mode" value="upload" /> アップロード</label>
                                <label><input type="radio" v-model="newImage2Mode" value="select" /> 既存から選択</label>
                            </div>
                            <div class="image-select-group">
                                <select v-if="newImage2Mode === 'select'" v-model="newImage2AssetId"
                                    class="admin-input">
                                    <option value="">選択なし</option>
                                    <option v-for="asset in imageAssets" :key="asset.id" :value="asset.id">{{ asset.name
                                        }}</option>
                                </select>
                                <input v-if="newImage2Mode === 'upload'" type="file" @change="onNewImage2Change"
                                    accept="image/*" class="admin-input" />
                                <span v-if="newImage2Mode === 'upload' && newImage2Filename" class="file-name">{{
                                    newImage2Filename }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="field-block left-col">
                        <label class="field-label">抽選アニメーション</label>
                        <select v-model="newPrizeAnimation" class="admin-input">
                            <option value="roulette">ルーレット</option>
                            <option value="slot">スロット</option>
                        </select>
                    </div>

                    <div class="field-block span-2">
                        <label class="field-label">BGM1</label>
                        <div class="bgm-mode">
                            <div class="bgm-radio-group">
                                <label><input type="radio" v-model="newBgm1Mode" value="upload" /> アップロード</label>
                                <label><input type="radio" v-model="newBgm1Mode" value="select" /> 既存から選択</label>
                            </div>
                            <div class="bgm-select-group">
                                <select v-if="newBgm1Mode === 'select'" v-model="newBgm1AssetId" class="admin-input">
                                    <option value="">選択なし</option>
                                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name
                                        }}</option>
                                </select>
                                <input v-if="newBgm1Mode === 'upload'" type="file" @change="onNewBgm1Change"
                                    accept="audio/*" class="admin-input" />
                                <span v-if="newBgm1Mode === 'upload' && newBgm1Filename" class="file-name">{{
                                    newBgm1Filename }}</span>
                            </div>
                        </div>
                    </div>

                    <div class="field-block span-2">
                        <label class="field-label">BGM2</label>
                        <div class="bgm-mode">
                            <div class="bgm-radio-group">
                                <label><input type="radio" v-model="newBgm2Mode" value="upload" /> アップロード</label>
                                <label><input type="radio" v-model="newBgm2Mode" value="select" /> 既存から選択</label>
                            </div>
                            <div class="bgm-select-group">
                                <select v-if="newBgm2Mode === 'select'" v-model="newBgm2AssetId" class="admin-input">
                                    <option value="">選択なし</option>
                                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name
                                        }}</option>
                                </select>
                                <input v-if="newBgm2Mode === 'upload'" type="file" @change="onNewBgm2Change"
                                    accept="audio/*" class="admin-input" />
                                <span v-if="newBgm2Mode === 'upload' && newBgm2Filename" class="file-name">{{
                                    newBgm2Filename }}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="add-side-column">
                    <div class="preview-box two-image-preview">
                        <template v-if="newImagePreview || newImage2Preview">
                            <div class="preview-half">
                                <img v-if="newImagePreview" :src="newImagePreview" alt="preview1" class="preview-img" />
                                <div v-else class="preview-placeholder small">画像1なし</div>
                            </div>
                            <div class="preview-half">
                                <img v-if="newImage2Preview" :src="newImage2Preview" alt="preview2"
                                    class="preview-img" />
                                <div v-else class="preview-placeholder small">画像2なし</div>
                            </div>
                        </template>
                        <template v-else>
                            <div class="preview-placeholder">プレビュー</div>
                        </template>
                    </div>
                </div>

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
/* styling is inherited from parent; keep it minimal here */
</style>
