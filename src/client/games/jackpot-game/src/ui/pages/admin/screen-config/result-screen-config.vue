<template>
    <div class="admin-section">
        <h2>最終結果画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>最終結果画面設定</h3>
                <div class="config-item">
                    <label>最終結果BGM:</label>
                    <select v-model="localConfig.resultBgm" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>最終結果SE1:</label>
                    <select v-model="localConfig.resultSe1" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>最終結果SE2:</label>
                    <select v-model="localConfig.resultSe2" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
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
import { ref, onMounted } from 'vue';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@model/applications/screen-config/screen-settings-service';

const screenSettingsService = container.resolve(ScreenSettingsService);

const audioAssets = ref<any[]>([]);
const loading = ref(false);
const loadingStatus = ref('');
const saving = ref(false);
const saveStatus = ref('');

const syncing = ref(false);
const syncStatus = ref("");

const localConfig = ref({
    resultBgm: "",
    resultSe1: "",
    resultSe2: "",
});

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting('result', 'result-screen-settings');
        if (cfg) {
            localConfig.value.resultBgm = (cfg as any).resultBgm || "";
            localConfig.value.resultSe1 = (cfg as any).resultSe1 || "";
            localConfig.value.resultSe2 = (cfg as any).resultSe2 || "";
        }
    } catch (error) {
        console.error("Failed to load result config:", error);
    }
};

onMounted(async () => {
    await loadConfig();
});

const handleSyncClick = async () => {
    syncing.value = true;
    syncStatus.value = "サーバーと同期中...";
    try {
        await screenSettingsService.syncToDrive();
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
            resultBgm: localConfig.value.resultBgm,
            resultSe1: localConfig.value.resultSe1,
            resultSe2: localConfig.value.resultSe2,
        };
        await screenSettingsService.saveScreenSetting('result', 'result-screen-settings', payload);
        await loadConfig();
        saveStatus.value = '保存しました';
    } catch (err) {
        console.error('Failed to save result config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};
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