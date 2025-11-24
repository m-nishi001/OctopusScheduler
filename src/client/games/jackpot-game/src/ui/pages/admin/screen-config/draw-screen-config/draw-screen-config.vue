<template>
    <div class="admin-section">
        <h2>本抽選画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>本抽選画面設定</h3>


                <div class="config-item">
                    <label>メンバー抽選のBGM:</label>
                    <div v-for="(_, index) in localConfig.memberLotteryBgms" :key="index" class="bgm-item">
                        <select v-model="localConfig.memberLotteryBgms[index]" class="admin-input">
                            <option value="">選択なし</option>
                            <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}
                            </option>
                        </select>
                        <button @click="removeMemberBgm(index)" class="remove-btn">削除</button>
                    </div>
                    <button @click="addMemberBgm" class="add-btn">BGM追加</button>
                </div>


                <!-- Per-prize BGM settings removed (handled per-prize elsewhere) -->


                <div class="config-item">
                    <label>メンバー抽選要求数 (memberDrawRequestCount)</label>
                    <input type="number" v-model.number="localConfig.memberDrawRequestCount" min="1"
                        class="admin-input" />
                    <div class="hint">メンバー抽選でアプリが要求する候補数（デフォルト 10）</div>
                </div>


                <div class="config-item">
                    <label>確変モード (kakuhenMode)</label>
                    <select v-model="localConfig.kakuhenMode" class="admin-input">
                        <option value="random">ランダム</option>
                        <option value="fixed">固定タイミング</option>
                    </select>
                </div>

                <div class="config-item">
                    <label>固定確変タイミング (kakuhenFixedTimings)</label>
                    <input type="text" v-model="kakuhenFixedTimingsText" class="admin-input" placeholder="例: 3,7" />
                    <div class="hint">kakuhenMode が fixed の場合、カンマ区切りの 1-based インデックスを入力してください。</div>
                </div>

                <div class="config-item">
                    <label>グローバル BGM ボリューム (0-100)</label>
                    <input type="number" step="1" v-model.number="localConfig.globalBgmVolume" min="0" max="100"
                        class="admin-input" />
                </div>


                <!-- Per-prize animation settings removed (handled per-prize elsewhere) -->


                <!-- animation preview removed -->
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
                    :style="{ opacity: saving ? 0.6 : 1 }">保存</button>

                <button class="admin-btn mt-4" @click="openTestDialog">テスト</button>
                <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
            </div>
            <div v-if="loading" class="modal-overlay">
                <div class="modal-content">
                    <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
                    <p>アセットを読み込んでいます。しばらくお待ちください。</p>
                    <div class="spinner"></div>
                </div>
            </div>

            <div v-if="saving" class="modal-overlay">
                <div class="modal-content">
                    <h3>保存中...</h3>
                    <p>{{ saveStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>



            <SimulationDialog :visible="testDialogVisible" @close="closeTestDialog" />

            <UnsavedChangesDialog :visible="showUnsavedDialog" @discard="handleDiscardChanges"
                @cancel="handleCancelDiscard" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { ScreenConfigService } from '@model/applications/screen-config/screen-config-service';
import SimulationDialog from './simulation-dialog.vue';
import UnsavedChangesDialog from '../unsaved-changes-dialog.vue';

const screenSettingsService = container.resolve(ScreenSettingsService);
const assetService = container.resolve(AssetDataService);
const screenConfigService = container.resolve(ScreenConfigService);

const audioAssets = ref<any[]>([]);
const loading = ref(false);
const loadingStatus = ref('');
const saving = ref(false);
const saveStatus = ref('');

const fetchAssets = async () => {
    try {
        const all = await assetService.getAllAssetData();

        audioAssets.value = all.filter((a: any) => !!a?.type && a.type.startsWith('audio/'));
    } catch (e) {
        audioAssets.value = [];
    }
};

// per-screen sync removed; use global bulk sync dialog instead

// preview UI removed: previewVisible/previewType/previewPrize deprecated

const testDialogVisible = ref(false);

const hasUnsavedChanges = ref(false);
const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const openTestDialog = () => {
    testDialogVisible.value = true;
};

const closeTestDialog = () => {
    testDialogVisible.value = false;
};

const localConfig = ref({
    memberLotteryBgms: [] as string[],
    memberDrawRequestCount: 10,
    kakuhenMode: 'random' as 'random' | 'fixed',
    kakuhenFixedTimings: [] as number[],
    globalBgmVolume: 50,
});

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
        if (cfg) {
            localConfig.value.memberLotteryBgms = (cfg as any).memberLotteryBgms || [];
            localConfig.value.memberDrawRequestCount = (cfg as any).memberDrawRequestCount || 10;
            localConfig.value.kakuhenMode = (cfg as any).kakuhenMode || 'random';
            localConfig.value.kakuhenFixedTimings = (cfg as any).kakuhenFixedTimings || [];
            localConfig.value.globalBgmVolume = typeof (cfg as any).globalBgmVolume === 'number' ? (cfg as any).globalBgmVolume : 50;
        }
    } catch (error) {
        console.error('Failed to load main config:', error);
    }
};

onMounted(async () => {
    await Promise.all([loadConfig(), fetchAssets()]);
    hasUnsavedChanges.value = false;
});

watch(localConfig, () => {
    hasUnsavedChanges.value = true;
}, { deep: true });

onBeforeRouteLeave((_to, _from, next) => {
    if (hasUnsavedChanges.value) {
        showUnsavedDialog.value = true;
        pendingRoute.value = next;
    } else {
        next();
    }
});

// per-screen sync removed; handled via header "一括同期"

const handleSaveClick = async () => {
    saving.value = true;
    saveStatus.value = '保存中...';
    try {
        // parse kakuhenFixedTimings text into array
        const raw = kakuhenFixedTimingsText.value || '';
        const arr = raw
            .split(',')
            .map((s) => parseInt(s.trim()))
            .filter((n) => !isNaN(n) && n > 0);
        localConfig.value.kakuhenFixedTimings = arr;

        const payload = {
            memberLotteryBgms: localConfig.value.memberLotteryBgms,
            memberDrawRequestCount: localConfig.value.memberDrawRequestCount,
            kakuhenMode: localConfig.value.kakuhenMode,
            kakuhenFixedTimings: localConfig.value.kakuhenFixedTimings,
            globalBgmVolume: localConfig.value.globalBgmVolume,
        };
        await screenSettingsService.saveScreenSetting('main', 'main-screen-settings', payload);
        await loadConfig();
        saveStatus.value = '保存しました';
        hasUnsavedChanges.value = false;
    } catch (err) {
        console.error('Failed to save main config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const handleDiscardChanges = () => {
    showUnsavedDialog.value = false;
    hasUnsavedChanges.value = false;
    // Clear temp assets if any (though this screen doesn't seem to have uploads)
    if (pendingRoute.value) {
        pendingRoute.value();
    }
};

const handleCancelDiscard = () => {
    showUnsavedDialog.value = false;
    pendingRoute.value = null;
};

const addMemberBgm = () => {
    localConfig.value.memberLotteryBgms.push("");
};

const removeMemberBgm = (index: number) => {
    localConfig.value.memberLotteryBgms.splice(index, 1);
};

// Per-prize music/animation helpers removed

// previewAnimation and closePreview removed

// removed variableTiming. keep prizes reference for potential UI use
// helper to bind/edit kakuhen fixed timings text
const kakuhenFixedTimingsText = ref('');

// initialize kakuhenFixedTimingsText after load
onMounted(async () => {
    await loadConfig();
    kakuhenFixedTimingsText.value = (localConfig.value.kakuhenFixedTimings || []).join(',');
});
</script>

<style scoped>
.screen-config {
    margin-bottom: 24px;
}

.screen-config h3 {
    margin-bottom: 16px;
    color: #fff;
}

.config-item {
    margin-bottom: 24px;
}

.config-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: #fff;
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: #232b36;
    color: #fff;
    font-size: 1rem;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
    margin-bottom: 8px;
    width: 100%;
}

.admin-input:focus {
    outline: 2px solid #4f8cff;
}

.asset-mode {
    display: flex;
    gap: 16px;
    margin-bottom: 16px;
}

.asset-mode label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #fff;
}


.admin-input {
    box-sizing: border-box;
    max-width: 100%;
    overflow-wrap: anywhere;
}

.asset-mode {
    flex-wrap: wrap;
}

.config-item {
    min-width: 0;
}

.bgm-item {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-bottom: 8px;
}

.remove-btn,
.add-btn {
    padding: 6px 12px;
    background: #4f8cff;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.remove-btn:hover,
.add-btn:hover {
    background: #3a7bd5;
}

.prize-music-item,
.prize-animation-item {
    margin-bottom: 16px;
    padding: 12px;
    background: #1a1a1a;
    border-radius: 8px;
}

.prize-name {
    font-weight: bold;
    margin-bottom: 8px;
    color: #fff;
}

.music-selects,
.animation-selects {
    display: flex;
    gap: 16px;
}

.animation-selects>div {
    flex: 1;
}

.preview-btn {
    padding: 6px 12px;
    background: #28a745;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    margin-left: 8px;
}

.preview-btn:hover {
    background: #218838;
}

.animation-preview {
    margin-top: 24px;
    padding: 16px;
    background: #1a1a1a;
    border-radius: 8px;
    text-align: center;
}

.animation-preview h4 {
    color: #fff;
    margin-bottom: 16px;
}

.close-btn {
    margin-top: 16px;
    padding: 8px 16px;
    background: #dc3545;
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.close-btn:hover {
    background: #c82333;
}

.hint {
    font-size: 0.8rem;
    color: #ccc;
    margin-top: 4px;
}

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
    text-align: center;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
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