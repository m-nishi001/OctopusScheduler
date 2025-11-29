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

// --- Helpers (shared for upload and parsing functions) ---
const parseCsvLine = (ln: string) => {
    // Simple parser: split by comma while honoring quoted values (double quotes)
    const cols: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < ln.length; i++) {
        const ch = ln[i];
        if (ch === '"') {
            // peek next char to detect escaped quote within quoted string
            const next = ln[i + 1];
            if (inQuotes && next === '"') {
                cur += '"';
                i++; // consume escaped quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (ch === ',' && !inQuotes) {
            cols.push(cur.trim());
            cur = '';
        } else {
            cur += ch;
        }
    }
    cols.push(cur.trim());
    return cols;
};

const norm = (s: string) => {
    try {
        return (s || '').normalize('NFC');
    } catch {
        return s || '';
    }
};

const upload = async () => {
    if (!csvFile.value || !assetFiles.value.length) return;
    uploading.value = true;
    message.value = 'アップロード中...';
    try {
        // Parse CSV first to get referenced filenames
        const csvText = await csvFile.value.text();
        const lines = csvText.split('\n').filter((line) => line.trim());
        if (lines.length < 2) throw new Error('CSV is empty or invalid');

        const dataLines = lines.slice(1);
        const referencedFilenames = new Set<string>();

        // parseCsvLine and norm available at module scope

        if (props.type === 'member') {
            for (const line of dataLines) {
                const cols = parseCsvLine(line).map((c) => c.trim());
                if (cols.length >= 3 && cols[2]) {
                    const raw = cols[2];
                    const rawN = norm(raw);
                    referencedFilenames.add(rawN);
                    referencedFilenames.add(rawN.toLowerCase());
                    try { referencedFilenames.add(rawN.split(/\\|\//).join('/')); } catch { }
                    referencedFilenames.add(rawN.split(/\\|\//).join('/').toLowerCase());
                }
            }
        } else {
            for (const line of dataLines) {
                const cols = parseCsvLine(line).map((c) => c.trim());
                if (cols.length >= 4) {
                    const addReferenced = (raw: string) => {
                        const rawN = norm(raw);
                        referencedFilenames.add(rawN);
                        referencedFilenames.add(rawN.toLowerCase());
                        try { referencedFilenames.add(rawN.split(/\\|\//).join('/')); } catch { }
                        referencedFilenames.add(rawN.split(/\\|\//).join('/').toLowerCase());
                        const base = raw.split(/\\|\//).pop() || raw;
                        const baseN = norm(base);
                        referencedFilenames.add(baseN);
                        referencedFilenames.add(baseN.toLowerCase());
                    };
                    if (cols[3]) addReferenced(cols[3]); // image1
                    if (cols.length >= 5 && cols[4]) addReferenced(cols[4]); // image2
                    if (cols.length >= 6 && cols[5]) addReferenced(cols[5]); // bgm1
                    if (cols.length >= 7 && cols[6]) addReferenced(cols[6]); // bgm2
                    if (cols.length >= 9 && cols[7]) addReferenced(cols[7]); // winning1
                    if (cols.length >= 10 && cols[8]) addReferenced(cols[8]); // winning2
                }
            }
        }

        // Upload only referenced assets
        const existingAssets = await assetDataService.getAllAssetData();
        // Map filename (case-insensitive) to asset metadata for quick lookup
        const existingAssetMap = new Map<string, { id: string; size: number }>();
        existingAssets.forEach(asset => {
            const nameN = norm(asset.name);
            existingAssetMap.set(nameN, { id: asset.id, size: asset.blob.size });
            // also store lowercase key for case-insensitive match
            existingAssetMap.set(nameN.toLowerCase(), { id: asset.id, size: asset.blob.size });
        });

        const uploadedAssets = [];
        // Build an index for assetFiles by name and by relative path
        const assetFilesByName = new Map<string, File[]>();
        const assetFilesByPath = new Map<string, File>();
        for (const file of assetFiles.value) {
            const normalizedFileName = norm(file.name);
            const list = assetFilesByName.get(normalizedFileName) || [];
            list.push(file);
            assetFilesByName.set(normalizedFileName, list);
            if ((file as any).webkitRelativePath) {
                // Also normalize the path key for consistent matching
                assetFilesByPath.set((file as any).webkitRelativePath.normalize('NFC'), file);
            }
        }

        for (const file of assetFiles.value) {
            const normalizedFileName = norm(file.name);
            const matchesName =
                referencedFilenames.has(normalizedFileName) ||
                referencedFilenames.has(normalizedFileName.toLowerCase());
            const relativePath = (file as any).webkitRelativePath || '';
            const matchesPath = relativePath && referencedFilenames.has(relativePath.normalize('NFC'));
            if (matchesName || matchesPath) {
                const existing = existingAssetMap.get(normalizedFileName) || existingAssetMap.get(normalizedFileName.toLowerCase());
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
            const nameN = norm(asset.name);
            assetMap.set(nameN, asset.id);
            assetMap.set(nameN.toLowerCase(), asset.id);
            // also map by basename (in case CSV references paths like images/foo.png)
            try {
                const base = (asset.name || '').split(/\\|\//).pop() || asset.name;
                const baseN = norm(base);
                assetMap.set(baseN, asset.id);
                assetMap.set(baseN.toLowerCase(), asset.id);
            } catch { /* ignore */ }
        });
        console.log('[DataUploadDialog] assetMap', Array.from(assetMap.entries()));

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
        const cols = parseCsvLine(line).map((c) => c.trim());
        if (cols.length < 3) continue;
        const name = cols[0];
        const rank = parseInt(cols[1]);
        const photoFilename = cols[2];
        const photoAssetId = photoFilename ? assetMap.get(norm(photoFilename)) || assetMap.get(norm(photoFilename).toLowerCase()) : undefined;
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
        const cols = parseCsvLine(line).map((c) => c.trim());
        if (cols.length < 4) continue;
        const name = cols[0];
        const rank = parseInt(cols[1]) || 0;
        const animation = cols[2] || 'roulette';
        const imageFilename = cols[3];
        let image2Filename = '';
        let bgm1Filename = '';
        let bgm2Filename = '';
        let winningImage1Filename = '';
        let winningImage2Filename = '';
        let orderValue = '0';
        if (cols.length >= 5) {
            if (cols.length === 6) {
                // Special case: assume no image2File, bgm1File and bgm2File at cols[4], [5]
                bgm1Filename = cols[4];
                bgm2Filename = cols[5];
            } else {
                // Normal case: image2File at cols[4], then bgm1, bgm2, etc.
                image2Filename = cols[4];
                if (cols.length >= 6) bgm1Filename = cols[5];
                if (cols.length >= 7) bgm2Filename = cols[6];
                if (cols.length >= 8) winningImage1Filename = cols[7];
                if (cols.length >= 9) winningImage2Filename = cols[8];
                if (cols.length >= 10) orderValue = cols[9];
            }
        }
        const order = parseInt(orderValue) || 0;
        const imageAssetId = imageFilename ? assetMap.get(norm(imageFilename)) || assetMap.get(norm(imageFilename).toLowerCase()) : undefined;
        const image2AssetId = image2Filename ? assetMap.get(norm(image2Filename)) || assetMap.get(norm(image2Filename).toLowerCase()) : undefined;
        const bgm1AssetId = bgm1Filename ? assetMap.get(norm(bgm1Filename)) || assetMap.get(norm(bgm1Filename).toLowerCase()) : undefined;
        const bgm2AssetId = bgm2Filename ? assetMap.get(norm(bgm2Filename)) || assetMap.get(norm(bgm2Filename).toLowerCase()) : undefined;
        const winningImage1AssetId = winningImage1Filename ? assetMap.get(norm(winningImage1Filename)) || assetMap.get(norm(winningImage1Filename).toLowerCase()) : undefined;
        const winningImage2AssetId = winningImage2Filename ? assetMap.get(norm(winningImage2Filename)) || assetMap.get(norm(winningImage2Filename).toLowerCase()) : undefined;
        const prize = {
            id: `upload_prize_${Date.now()}_${i}`,
            name,
            rank,
            animation,
            imageAssetId,
            image2AssetId,
            bgm1AssetId,
            bgm2AssetId,
            winningImage1AssetId,
            winningImage2AssetId,
            order
        };
        // Debug log: show mapping from CSV filenames -> resolved asset IDs
        console.log('[DataUploadDialog] prize asset mapping', {
            row: i,
            name,
            imageFilename,
            imageAssetId,
            image2Filename,
            image2AssetId,
            bgm1Filename,
            bgm1AssetId,
            bgm2Filename,
            bgm2AssetId,
            winningImage1Filename,
            winningImage1AssetId,
            winningImage2Filename,
            winningImage2AssetId,
            order,
        });
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