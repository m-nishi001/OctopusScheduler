<template>
    <div class="admin-section">
        <h2>本抽選画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">
                <h3>本抽選画面設定</h3>

                <!-- メンバー抽選のBGM -->
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

                <!-- 景品単位で抽選音楽 -->
                <div class="config-item">
                    <label>景品単位で抽選音楽:</label>
                    <div v-for="prize in prizes" :key="prize.id" class="prize-music-item">
                        <div class="prize-name">{{ prize.name }}</div>
                        <div class="music-selects">
                            <div>
                                <label>Primary:</label>
                                <select :value="getPrizeMusic(prize.id, 'primary')"
                                    @change="updatePrizeMusic(prize.id, 'primary', ($event.target as HTMLSelectElement).value)"
                                    class="admin-input">
                                    <option value="">選択なし</option>
                                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name
                                        }}</option>
                                </select>
                            </div>
                            <div>
                                <label>Secondary:</label>
                                <select :value="getPrizeMusic(prize.id, 'secondary')"
                                    @change="updatePrizeMusic(prize.id, 'secondary', ($event.target as HTMLSelectElement).value)"
                                    class="admin-input">
                                    <option value="">選択なし</option>
                                    <option v-for="asset in audioAssets" :key="asset.id" :value="asset.id">{{ asset.name
                                        }}</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 確変タイミング -->
                <div class="config-item">
                    <label>確変タイミング (景品が何個出てきたら):</label>
                    <input type="number" v-model.number="localConfig.variableTiming" :min="1" :max="maxVariableTiming"
                        class="admin-input" />
                    <div class="hint">1 から {{ maxVariableTiming }} の範囲で入力してください。</div>
                </div>

                <!-- 景品単位での抽選アニメーション -->
                <div class="config-item">
                    <label>景品単位での抽選アニメーション:</label>
                    <div v-for="prize in prizes" :key="prize.id" class="prize-animation-item">
                        <div class="prize-name">{{ prize.name }}</div>
                        <div class="animation-selects">
                            <div>
                                <label>Primary:</label>
                                <select :value="getPrizeAnimation(prize.id, 'primary')"
                                    @change="updatePrizeAnimation(prize.id, 'primary', ($event.target as HTMLSelectElement).value)"
                                    class="admin-input">
                                    <option value="">未実装</option>
                                    <option value="roulette">ルーレット</option>
                                    <option value="slot">スロット</option>
                                    <option value="treasure">宝箱</option>
                                    <option value="particle">パーティクル</option>
                                    <option value="zoom">ズーム</option>
                                </select>
                                <button @click="previewAnimation(getPrizeAnimation(prize.id, 'primary'), prize)"
                                    class="preview-btn">プレビュー</button>
                            </div>
                            <div>
                                <label>Secondary:</label>
                                <select :value="getPrizeAnimation(prize.id, 'secondary')"
                                    @change="updatePrizeAnimation(prize.id, 'secondary', ($event.target as HTMLSelectElement).value)"
                                    class="admin-input">
                                    <option value="">未実装</option>
                                    <option value="roulette">ルーレット</option>
                                    <option value="slot">スロット</option>
                                    <option value="treasure">宝箱</option>
                                    <option value="particle">パーティクル</option>
                                    <option value="zoom">ズーム</option>
                                </select>
                                <button @click="previewAnimation(getPrizeAnimation(prize.id, 'secondary'), prize)"
                                    class="preview-btn">プレビュー</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- アニメーションプレビュー -->
                <div v-if="previewVisible" class="animation-preview">
                    <h4>アニメーションプレビュー</h4>
                    <RouletteAnimation v-if="previewType === 'roulette'" :prizes="prizes" :selectedPrize="previewPrize"
                        :showResult="true" />
                    <SlotAnimation v-if="previewType === 'slot'" :selectedPrize="previewPrize" :showResult="true" />
                    <TreasureAnimation v-if="previewType === 'treasure'" :selectedPrize="previewPrize"
                        :showResult="true" />
                    <ParticleAnimation v-if="previewType === 'particle'" :selectedPrize="previewPrize"
                        :showResult="true" />
                    <ZoomAnimation v-if="previewType === 'zoom'" :selectedPrize="previewPrize" :showResult="true" />
                    <button @click="closePreview" class="close-btn">閉じる</button>
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <button class="admin-btn mt-4" @click="handleSaveClick" :disabled="saving"
                    :style="{ opacity: saving ? 0.6 : 1 }">保存</button>
                <button class="admin-btn mt-4" @click="handleSyncClick" :disabled="syncing"
                    :style="{ opacity: syncing ? 0.6 : 1 }">同期</button>
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
            <!-- 同期モーダル -->
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
import RouletteAnimation from '../../main-draw/RouletteAnimation.vue';
import SlotAnimation from '../../main-draw/SlotAnimation.vue';
import TreasureAnimation from '../../main-draw/TreasureAnimation.vue';
import ParticleAnimation from '../../main-draw/ParticleAnimation.vue';
import ZoomAnimation from '../../main-draw/ZoomAnimation.vue';
import type { PrizeDto } from '../../../../model/applications/prize/dto/prize-dto';

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
        audioAssets.value = await assetService.getAllAssetData();
    } catch (e) {
        audioAssets.value = [];
    }
};

const syncing = ref(false);
const syncStatus = ref("");

const previewVisible = ref(false);
const previewType = ref('');
const previewPrize = ref<PrizeDto | null>(null);

const localConfig = ref({
    memberLotteryBgms: [] as string[],
    prizeLotteryMusics: [] as { prizeId: string; primary: string; secondary: string }[],
    variableTiming: 1,
    prizeAnimations: [] as { prizeId: string; primary: string; secondary: string }[],
});

const loadConfig = async () => {
    try {
        const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
        if (cfg) {
            localConfig.value.memberLotteryBgms = (cfg as any).memberLotteryBgms || [];
            localConfig.value.prizeLotteryMusics = (cfg as any).prizeLotteryMusics || [];
            localConfig.value.variableTiming = (cfg as any).variableTiming || 1;
            localConfig.value.prizeAnimations = (cfg as any).prizeAnimations || [];
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
        // no converters: save raw config object
        const payload = {
            memberLotteryBgms: localConfig.value.memberLotteryBgms,
            prizeLotteryMusics: localConfig.value.prizeLotteryMusics,
            variableTiming: localConfig.value.variableTiming,
            prizeAnimations: localConfig.value.prizeAnimations,
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

const updatePrizeMusic = (prizeId: string, type: 'primary' | 'secondary', value: string) => {
    let existing = localConfig.value.prizeLotteryMusics.find(p => p.prizeId === prizeId);
    if (!existing) {
        existing = { prizeId, primary: '', secondary: '' };
        localConfig.value.prizeLotteryMusics.push(existing);
    }
    existing[type] = value;
};

const getPrizeMusic = (prizeId: string, type: 'primary' | 'secondary') => {
    const existing = localConfig.value.prizeLotteryMusics.find(p => p.prizeId === prizeId);
    return existing ? existing[type] : '';
};

const updatePrizeAnimation = (prizeId: string, type: 'primary' | 'secondary', value: string) => {
    let existing = localConfig.value.prizeAnimations.find(p => p.prizeId === prizeId);
    if (!existing) {
        existing = { prizeId, primary: '', secondary: '' };
        localConfig.value.prizeAnimations.push(existing);
    }
    existing[type] = value;
};

const getPrizeAnimation = (prizeId: string, type: 'primary' | 'secondary') => {
    const existing = localConfig.value.prizeAnimations.find(p => p.prizeId === prizeId);
    return existing ? existing[type] : '';
};

const previewAnimation = (type: string, prize: PrizeDto) => {
    if (!type) return;
    previewType.value = type;
    previewPrize.value = prize;
    previewVisible.value = true;
};

const closePreview = () => {
    previewVisible.value = false;
    previewType.value = '';
    previewPrize.value = null;
};

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