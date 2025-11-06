<template>
    <div v-if="show" class="modal-overlay">
        <div class="modal-content">
            <h3>データアップロード</h3>
            <p>CSVファイルとアセットフォルダを選択してください。</p>
            <div class="field-block">
                <label class="field-label">CSVファイル</label>
                <input type="file" @change="onCsvChange" accept=".csv" class="admin-input" />
                <span v-if="csvFile" class="file-name">{{ csvFile.name }}</span>
            </div>
            <div class="field-block">
                <label class="field-label">アセットフォルダ</label>
                <input type="file" @change="onFolderChange" webkitdirectory multiple class="admin-input" />
                <span v-if="assetFiles.length" class="file-name">{{ assetFiles.length }} ファイル選択</span>
            </div>
            <div class="modal-actions">
                <button class="admin-btn" @click="upload"
                    :disabled="!csvFile || !assetFiles.length || uploading">アップロード</button>
                <button class="admin-btn cancel-primary" @click="$emit('close')">キャンセル</button>
            </div>
            <div v-if="uploading" class="spinner"></div>
            <p v-if="message">{{ message }}</p>
        </div>
    </div>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { MemberService } from '@model/applications/member/member-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import { container } from 'tsyringe';

const props = defineProps<{
    show: boolean;
    type: 'member' | 'prize';
}>();

const emit = defineEmits<{
    close: [];
    refresh: [];
}>();

const assetDataService = container.resolve(AssetDataService);
const memberService = container.resolve(MemberService);
const prizeService = container.resolve(PrizeService);

const csvFile = ref<File | null>(null);
const assetFiles = ref<File[]>([]);
const uploading = ref(false);
const message = ref('');

const onCsvChange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (file) {
        csvFile.value = file;
    }
};

const onFolderChange = (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (files) {
        assetFiles.value = Array.from(files);
    }
};

const upload = async () => {
    if (!csvFile.value || !assetFiles.value.length) return;
    uploading.value = true;
    message.value = 'アップロード中...';
    try {
        // Parse CSV first to get referenced filenames
        const csvText = await csvFile.value.text();
        const lines = csvText.split('\n').filter(line => line.trim());
        if (lines.length < 2) throw new Error('CSV is empty or invalid');

        const dataLines = lines.slice(1);
        const referencedFilenames = new Set<string>();

        if (props.type === 'member') {
            for (const line of dataLines) {
                const cols = line.split(',').map(c => c.trim());
                if (cols.length >= 3 && cols[2]) {
                    referencedFilenames.add(cols[2]);
                }
            }
        } else {
            for (const line of dataLines) {
                const cols = line.split(',').map(c => c.trim());
                if (cols.length >= 6) {
                    if (cols[3]) referencedFilenames.add(cols[3]);
                    if (cols[4]) referencedFilenames.add(cols[4]);
                    if (cols[5]) referencedFilenames.add(cols[5]);
                }
            }
        }

        // Upload only referenced assets
        const existingAssets = await assetDataService.getAllAssetData();
        const existingAssetMap = new Map<string, { id: string; size: number }>();
        existingAssets.forEach(asset => {
            existingAssetMap.set(asset.name, { id: asset.id, size: asset.blob.size });
        });

        const uploadedAssets = [];
        for (const file of assetFiles.value) {
            if (referencedFilenames.has(file.name)) {
                const existing = existingAssetMap.get(file.name);
                if (existing && existing.size === file.size) {
                    // Skip upload if same file already exists
                    uploadedAssets.push({ id: existing.id, name: file.name });
                } else {
                    const dto = await assetDataService.createDriveDataDtoFromFile(file);
                    const uploaded = await assetDataService.addAssetData([dto]);
                    uploadedAssets.push(...uploaded);
                }
            }
        }
        const assetMap = new Map<string, string>();
        uploadedAssets.forEach(asset => {
            assetMap.set(asset.name, asset.id);
        });

        if (props.type === 'member') {
            await uploadMembers(dataLines, assetMap);
        } else {
            await uploadPrizes(dataLines, assetMap);
        }

        message.value = 'アップロード完了';
        emit('refresh');
        setTimeout(() => {
            emit('close');
        }, 1000);
    } catch (error) {
        console.error('Upload failed:', error);
        message.value = 'アップロード失敗: ' + (error as Error).message;
    } finally {
        uploading.value = false;
    }
};

const uploadMembers = async (dataLines: string[], assetMap: Map<string, string>) => {
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 3) continue;
        const name = cols[0];
        const rank = parseInt(cols[1]);
        const photoFilename = cols[2];
        const photoAssetId = photoFilename ? assetMap.get(photoFilename) : undefined;
        const member = {
            id: `upload_member_${Date.now()}_${i}`,
            name,
            rank,
            photoAssetId
        };
        await memberService.saveMember(member);
    }
};

const uploadPrizes = async (dataLines: string[], assetMap: Map<string, string>) => {
    for (let i = 0; i < dataLines.length; i++) {
        const line = dataLines[i];
        const cols = line.split(',').map(c => c.trim());
        if (cols.length < 6) continue;
        const name = cols[0];
        const rank = parseInt(cols[1]);
        const animation = cols[2];
        const imageFilename = cols[3];
        const bgm1Filename = cols[4];
        const bgm2Filename = cols[5];
        const imageAssetId = imageFilename ? assetMap.get(imageFilename) : undefined;
        const bgm1AssetId = bgm1Filename ? assetMap.get(bgm1Filename) : undefined;
        const bgm2AssetId = bgm2Filename ? assetMap.get(bgm2Filename) : undefined;
        const prize = {
            id: `upload_prize_${Date.now()}_${i}`,
            name,
            rank,
            animation,
            imageAssetId,
            bgm1AssetId,
            bgm2AssetId,
            order: 0 // will be set later
        };
        await prizeService.savePrize(prize);
    }
};
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
    background: #232b36;
    color: #fff;
    padding: 28px;
    border-radius: 10px;
    text-align: left;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 500px;
    width: 90%;
}

.field-label {
    display: block;
    margin-bottom: 8px;
    color: #cfe8ff;
    font-weight: 600;
}

.field-block {
    margin-top: 12px;
}

.admin-input {
    padding: 10px 14px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 0.98rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

.admin-btn {
    padding: 9px 18px;
    border-radius: 10px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: 700;
    cursor: pointer;
    transition: box-shadow 0.18s, background 0.18s, transform 0.12s;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.admin-btn:hover {
    box-shadow: 0 6px 18px rgba(79, 140, 255, 0.16);
}

.admin-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
}

.cancel-primary {
    background: #3b4650;
    color: #fff;
}

.modal-actions {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.file-name {
    margin-top: 8px;
    color: #cfe8ff;
    font-size: 0.92rem;
}

.spinner {
    margin: 16px auto;
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #4f8cff;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% {
        transform: rotate(0deg);
    }

    100% {
        transform: rotate(360deg);
    }
}
</style>