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
                    <label>確変タイミング (景品が何個出てきたら):</label>
                    <input type="number" v-model.number="localConfig.variableTiming" :min="1" :max="maxVariableTiming"
                        class="admin-input" />
                    <div class="hint">1 から {{ maxVariableTiming }} の範囲で入力してください。</div>
                </div>


                <!-- Per-prize animation settings removed (handled per-prize elsewhere) -->


                <!-- animation preview removed -->
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
                    :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
                <button class="admin-btn mt-4" @click="handleSyncClick" :disabled="syncing"
                    :style="{ opacity: syncing ? 0.6 : 1 }">同期</button>
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

            <div v-if="syncing" class="modal-overlay">
                <div class="modal-content">
                    <h3>同期中...</h3>
                    <p>{{ syncStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '../../../../model/applications/screen-config/screen-settings-service';
import { AssetDataService } from '../../../../model/applications/asset/asset-data-service';
import { ScreenConfigService } from '../../../../model/applications/screen-config/screen-config-service';
// Preview components removed; no imports needed

const screenSettingsService = container.resolve(ScreenSettingsService);
const assetService = container.resolve(AssetDataService);
const screenConfigService = container.resolve(ScreenConfigService);

const audioAssets = ref<any[]>([]);
const prizes = ref<any[]>([]);
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

const syncing = ref(false);
const syncStatus = ref("");

// preview UI removed: previewVisible/previewType/previewPrize deprecated

const localConfig = ref({
    memberLotteryBgms: [] as string[],
    variableTiming: 1,
});

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
        if (cfg) {
            localConfig.value.memberLotteryBgms = (cfg as any).memberLotteryBgms || [];
            localConfig.value.variableTiming = (cfg as any).variableTiming || 1;
        }
    } catch (error) {
        console.error('Failed to load main config:', error);
    }
};

onMounted(async () => {
    await Promise.all([loadConfig(), fetchAssets()]);
});

const handleSyncClick = async () => {
    syncing.value = true;
    syncStatus.value = "サーバーと同期中...";
    try {
        await screenConfigService.syncScreenConfigs();
        await loadConfig();
        syncStatus.value = "同期完了";
    } catch (error) {
        console.error("Failed to sync screen configs:", error);
        syncStatus.value = "同期に失敗しました";
    } finally {
        syncing.value = false;
    }
};

const handleSaveClick = async () => {
    saving.value = true;
    saveStatus.value = '保存中...';
    try {

        const payload = {
            memberLotteryBgms: localConfig.value.memberLotteryBgms,
            variableTiming: localConfig.value.variableTiming,
        };
        await screenSettingsService.saveScreenSetting('main', 'main-screen-settings', payload);
        await loadConfig();
        saveStatus.value = '保存しました';
    } catch (err) {
        console.error('Failed to save main config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const addMemberBgm = () => {
    localConfig.value.memberLotteryBgms.push("");
};

const removeMemberBgm = (index: number) => {
    localConfig.value.memberLotteryBgms.splice(index, 1);
};

// Per-prize music/animation helpers removed

// previewAnimation and closePreview removed

const maxVariableTiming = computed(() => prizes.value.length);
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