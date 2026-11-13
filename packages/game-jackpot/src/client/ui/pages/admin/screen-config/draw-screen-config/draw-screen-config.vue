<template>
    <div class="admin-section">
        <h2>本抽選画面設定</h2>
        <div class="tab-content">
            <div class="screen-config">


                <div class="config-item">
                    <label>メンバー抽選のBGM:</label>
                    <div v-for="(bgm, index) in localConfig.memberLotteryBgms" :key="index" class="bgm-item">
                        <MediaPicker :label="`BGM${index + 1}`" kind="audio" :model-value="bgm"
                            @update:model-value="setMemberBgm(index, $event)"
                            :options="draft.optionsOf('audio')" :preview-url="draft.urlOf(bgm)"
                            @pick="draft.pick" />
                        <button @click="removeMemberBgm(index)" class="remove-btn">削除</button>
                    </div>
                    <button @click="addMemberBgm" class="add-btn">BGM追加</button>
                </div>


                <!-- Per-prize BGM settings removed (handled per-prize elsewhere) -->


                <div class="config-item">
                    <label>景品抽選が止まるまでの時間(秒)</label>
                    <input type="number" v-model.number="prizeStopSec" class="admin-input"
                        :min="MIN_PRIZE_STOP_SEC" :max="MAX_PRIZE_STOP_SEC" step="0.5" data-testid="prize-stop-sec" />
                    <div class="hint">
                        停止ボタンを押してから、最後の景品が止まるまでの長さ。スロット・ルーレット共通。確変の演出は変わりません。
                        {{ MIN_PRIZE_STOP_SEC }}〜{{ MAX_PRIZE_STOP_SEC }}秒(0.5秒刻み)、初期値は{{ DEFAULT_PRIZE_STOP_SEC }}秒です。
                    </div>
                </div>

                <div class="config-item">
                    <label class="kakuhen-check">
                        <input type="checkbox" v-model="participantStop" data-testid="participant-stop-checkbox" />
                        <span>参加者が景品ルーレットを止めることができる</span>
                    </label>
                    <div class="hint">
                        外すと、当選した参加者のスマホに停止ボタンが出ません。会場の端末の Enter キー(物理ボタン)や管理者コンソールの「止める」では止められます。
                    </div>
                </div>

                <div class="config-item">
                    <label>確変の起こし方</label>
                    <select v-model="kakuhenMode" class="admin-input" data-testid="kakuhen-mode">
                        <option value="auto">おまかせ（景品の真ん中あたりで、確変対応ありの景品の数だけ続けて）</option>
                        <option value="fixed">回を指定する</option>
                    </select>
                </div>

                <div v-if="localConfig.kakuhenMode === 'fixed'" class="config-item">
                    <label>確変にする回</label>
                    <input type="text" v-model="kakuhenTimingsText" class="admin-input" placeholder="例: 3, 7"
                        data-testid="kakuhen-timings" />
                    <div class="hint">
                        「何回目の抽選か」をカンマ区切りで入力します（例: 3, 7）。空欄なら確変は起きません。
                        確変の回には確変対応ありの景品だけが当たるので、回数は確変対応ありの景品の数に合わせてください。
                        この設定は、本番の抽選を始めるときに一度だけ確定します。抽選が始まったあとに変えても、結果をリセットするまでは反映されません。
                    </div>
                </div>


                <div class="config-item kakuhen-summary" data-testid="kakuhen-summary">
                    <div class="hint">確変対応ありの景品: {{ kakuhenPrizeCount }}件
                        <template v-if="localConfig.kakuhenMode === 'auto'">（おまかせでは、確変は{{ kakuhenPrizeCount }}回になります）</template>
                    </div>
                    <div v-if="kakuhenWarning" class="warning" role="alert" data-testid="kakuhen-warning">
                        {{ kakuhenWarning }}
                    </div>
                </div>

                <!-- Per-prize animation settings removed (handled per-prize elsewhere) -->


                <!-- animation preview removed -->
            </div>
            <div style="display:flex;align-items:center;gap:12px;">
                <UiButton @click="handleSaveClick" :disabled="saving">保存</UiButton>

                <UiButton @click="openTestDialog">テスト</UiButton>
                <div class="status-text">{{ saveStatus }}</div>
            </div>
            <UiBusyOverlay :visible="loading" :title="loadingStatus || 'データを読み込み中...'" message="アセットを読み込んでいます。しばらくお待ちください。" />

            <UiBusyOverlay :visible="saving" title="保存中..." :message="saveStatus" />



            <SimulationDialog :visible="testDialogVisible" @close="closeTestDialog" />

            <UnsavedChangesDialog :visible="showUnsavedDialog" @discard="handleDiscardChanges"
                @cancel="handleCancelDiscard" />
        </div>
    </div>
</template>

<script setup lang="ts">
import { UiBusyOverlay, UiButton } from '@octopus/ui-kit';
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { eventBus } from '@octopus/client-common/events/event-bus';
import { onBeforeRouteLeave } from 'vue-router';
import { container } from 'tsyringe';
import { ScreenSettingsService } from '@control/screen-config/screen-settings-service';
import { useMediaDraft } from '@ui/composables/use-media-draft';
import { useFormDraft } from '@ui/composables/use-form-draft';
import MediaPicker from '@ui/components/media-picker.vue';
import SimulationDialog from './simulation-dialog.vue';
import UnsavedChangesDialog from '../unsaved-changes-dialog.vue';
import { kakuhenCountWarning, parseKakuhenPlan, parseTimingsText } from '@model/draw/kakuhen-plan';
import { JackpotRepository } from '@model/jackpot-repository';
import { countKakuhenPrizes } from '@model/prize/prize-kakuhen';
import type { KakuhenMode } from '@model/draw/kakuhen-plan';
import { parseParticipantStop, DEFAULT_PARTICIPANT_STOP } from '@model/draw/participant-stop';
import { clampPrizeStopSec, parsePrizeStopSec, DEFAULT_PRIZE_STOP_SEC, MIN_PRIZE_STOP_SEC, MAX_PRIZE_STOP_SEC } from '@model/draw/prize-stop-sec';

const screenSettingsService = container.resolve(ScreenSettingsService);
const draft = useMediaDraft();
const loading = ref(false);
const loadingStatus = ref('');
const saving = ref(false);
const saveStatus = ref('');

// per-screen sync removed; use global bulk sync dialog instead

// preview UI removed: previewVisible/previewType/previewPrize deprecated

const testDialogVisible = ref(false);

const showUnsavedDialog = ref(false);
const pendingRoute = ref<(() => void) | null>(null);

const openTestDialog = () => {
    testDialogVisible.value = true;
};

const closeTestDialog = () => {
    testDialogVisible.value = false;
};

/** サーバーの値(読み込み・同期で更新)に、利用者が触った項目だけを重ねて持つ。入力欄は読み込み前から操作できる。 */
interface DrawConfigForm {
    memberLotteryBgms: string[];
    kakuhenMode: KakuhenMode;
    prizeStopSec: number | string;
    participantStop: boolean;
    /** 確変にする回の入力欄の文字（カンマ区切り）。保存時に回の一覧にする。 */
    kakuhenTimingsText: string;
}

const fetchConfig = async (): Promise<DrawConfigForm> => {
    const cfg = await screenSettingsService.fetchScreenSetting('main', 'main-screen-settings');
    const plan = parseKakuhenPlan(cfg);
    return {
        memberLotteryBgms: cfg?.memberLotteryBgms || [],
        kakuhenMode: plan.mode,
        prizeStopSec: parsePrizeStopSec(cfg),
        participantStop: parseParticipantStop(cfg),
        kakuhenTimingsText: plan.fixedTimings.join(', '),
    };
};

const form = useFormDraft<DrawConfigForm>({
    memberLotteryBgms: [],
    kakuhenMode: 'auto',
    prizeStopSec: DEFAULT_PRIZE_STOP_SEC,
    participantStop: DEFAULT_PARTICIPANT_STOP,
    kakuhenTimingsText: '',
}, fetchConfig);
const localConfig = form.view;
const hasUnsavedChanges = form.dirty;

const prizeStopSec = computed({ get: () => localConfig.value.prizeStopSec, set: (v) => form.set('prizeStopSec', v) });
const participantStop = computed({ get: () => localConfig.value.participantStop, set: (v) => form.set('participantStop', v) });
const kakuhenMode = computed({ get: () => localConfig.value.kakuhenMode, set: (v) => form.set('kakuhenMode', v) });
const kakuhenTimingsText = computed({ get: () => localConfig.value.kakuhenTimingsText, set: (v) => form.set('kakuhenTimingsText', v) });
draft.track(() => localConfig.value.memberLotteryBgms);

/** 確変対応ありの景品の数。確変の回数はこれに合わせる。 */
const kakuhenPrizeCount = ref(0);
const loadKakuhenPrizeCount = async () => {
    try {
        kakuhenPrizeCount.value = countKakuhenPrizes(await container.resolve(JackpotRepository).getPrizes());
    } catch (error) {
        console.error('Failed to load prizes:', error);
    }
};
/** 回を指定したとき、その回数が確変対応ありの景品の数と違えば警告する(保存はできる)。 */
const kakuhenWarning = computed(() =>
    localConfig.value.kakuhenMode === 'fixed'
        ? kakuhenCountWarning(parseTimingsText(localConfig.value.kakuhenTimingsText).length, kakuhenPrizeCount.value)
        : null);

// 他の端末の変更が取り込まれたら読み直す(古い値のフォームを、そのまま保存して上書きしないため)。
// 読み込みは「サーバーの値」だけを更新し、入力の途中の項目には触れない
const reloadAfterSync = async () => {
    await Promise.all([form.load(), loadKakuhenPrizeCount()]);
};

onMounted(async () => {
    eventBus.on('syncPulled', reloadAfterSync);
    await Promise.all([form.load(), draft.reload(), loadKakuhenPrizeCount()]);
});

onBeforeUnmount(() => {
    eventBus.off('syncPulled', reloadAfterSync);
});

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
        await form.save(async (cfg) => {
            const payload = {
                memberLotteryBgms: cfg.memberLotteryBgms,
                kakuhenMode: cfg.kakuhenMode,
                kakuhenFixedTimings: parseTimingsText(cfg.kakuhenTimingsText),
                prizeStopSec: clampPrizeStopSec(cfg.prizeStopSec),
                participantStop: cfg.participantStop,
            };
            await screenSettingsService.saveScreenSetting('main', 'main-screen-settings', payload, draft.filesFor(payload.memberLotteryBgms));
        });
        await draft.reload();
        saveStatus.value = '保存しました';
    } catch (err) {
        console.error('Failed to save main config', err);
        saveStatus.value = '保存に失敗しました';
    } finally {
        saving.value = false;
    }
};

const handleDiscardChanges = () => {
    showUnsavedDialog.value = false;
    form.discard();
    if (pendingRoute.value) {
        pendingRoute.value();
    }
};

const handleCancelDiscard = () => {
    showUnsavedDialog.value = false;
    pendingRoute.value = null;
};

const addMemberBgm = () => {
    form.edit('memberLotteryBgms', (list) => { list.push(""); });
};

const setMemberBgm = (index: number, name: string) => {
    form.edit('memberLotteryBgms', (list) => { list[index] = name; });
};

const removeMemberBgm = (index: number) => {
    form.edit('memberLotteryBgms', (list) => { list.splice(index, 1); });
};

// Per-prize music/animation helpers removed

// previewAnimation and closePreview removed
</script>

<style scoped>
.kakuhen-check {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    cursor: pointer;
}

.status-text {
    font-size: var(--ui-font-sm, 0.875rem);
    color: var(--ui-text-muted, #cfd6dd);
}

.screen-config {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    column-gap: 24px;
    margin-bottom: 12px;
}

.screen-config h3 {
    margin-bottom: 16px;
    color: var(--ui-text, #fff);
}

.config-item {
    margin-bottom: 12px;
}

.config-item label {
    display: block;
    margin-bottom: 8px;
    font-weight: bold;
    color: var(--ui-text, #fff);
}

.admin-input {
    padding: 10px 16px;
    border-radius: 8px;
    border: none;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    font-size: var(--ui-font-md, 1rem);
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
    color: var(--ui-text, #fff);
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
    color: var(--ui-text, #fff);
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
    color: var(--ui-text, #fff);
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
    color: var(--ui-text, #fff);
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
    color: var(--ui-text, #fff);
    margin-bottom: 16px;
}

.close-btn {
    margin-top: 16px;
    padding: 8px 16px;
    background: #dc3545;
    color: var(--ui-text, #fff);
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.close-btn:hover {
    background: #c82333;
}

.warning {
    margin-top: 6px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #e0a800;
    background: rgba(224, 168, 0, 0.15);
    color: var(--ui-text, #fff);
    font-size: var(--ui-font-sm, 0.875rem);
}

.hint {
    font-size: var(--ui-font-xs, 0.75rem);
    color: var(--ui-text-muted, #cfd6dd);
    margin-top: 4px;
}
</style>