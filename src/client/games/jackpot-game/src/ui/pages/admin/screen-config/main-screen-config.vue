<template>
    <div class="admin-section">
        <h2>本抽選画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>本抽選画面設定</h3>
                <div class="config-item">
                    <label>本抽選BGM:</label>
                    <select v-model="localConfig.mainBgm" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>本抽選SE1:</label>
                    <select v-model="localConfig.mainSe1" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
                <div class="config-item">
                    <label>本抽選SE2:</label>
                    <select v-model="localConfig.mainSe2" class="admin-input">
                        <option value="">選択なし</option>
                        <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name }}</option>
                    </select>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
                    :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
                <div style="color:#fff;font-size:0.9rem;">{{ saveStatus }}</div>
            </div>
            <!-- ロードモーダル -->
            <div v-if="loading" class="modal-overlay">
                <div class="modal-content">
                    <h3>{{ loadingStatus || 'データを読み込み中...' }}</h3>
                    <p>アセットを読み込んでいます。しばらくお待ちください。</p>
                    <div class="spinner"></div>
                </div>
            </div>
            <!-- 保存モーダル -->
            <div v-if="saving" class="modal-overlay">
                <div class="modal-content">
                    <h3>保存中...</h3>
                    <p>{{ saveStatus }}</p>
                    <div class="spinner"></div>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useScreenSettingData } from './use-screen-setting-data';
import { MainScreenConfig } from '../../../../model/domains/screen-config/main-screen-config';
import { MainScreenConfigConverter } from '../../../../model/applications/screen-config/main/main-screen-config-converter';
import { container } from 'tsyringe';

const {
    screenConfigService,
    audioAssets,
    loading,
    loadingStatus,
    saving,
    saveStatus,
    handleSave,
} = useScreenSettingData();

const localConfig = ref({
    mainBgm: "",
    mainSe1: "",
    mainSe2: "",
});

const loadConfig = async () => {
    try {
        const config = await screenConfigService.fetchScreenConfig("main");
        if (config) {
            localConfig.value = {
                mainBgm: (config as any).mainBgm || "",
                mainSe1: (config as any).mainSe1 || "",
                mainSe2: (config as any).mainSe2 || "",
            };
        }
    } catch (error) {
        console.error("Failed to load main config:", error);
    }
};

onMounted(async () => {
    await loadConfig();
});

const handleSaveClick = async () => {
    await handleSave(async () => {
        const config = new MainScreenConfig(
            localConfig.value.mainBgm,
            localConfig.value.mainSe1,
            localConfig.value.mainSe2
        );
        const converter = container.resolve(MainScreenConfigConverter);
        const settings = converter.toSettings(config);
        await screenConfigService.saveScreenConfigs(settings);
        await loadConfig();
    });
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

/* Prevent inputs and flex children from causing horizontal overflow */
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
</style>