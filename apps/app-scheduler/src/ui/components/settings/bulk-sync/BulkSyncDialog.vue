<template>
    <div v-if="visible" class="bulk-sync-overlay">
        <div class="bulk-sync-dialog">
            <h3>一括同期</h3>

            <div class="section">
                <label>
                    <input type="radio" v-model="syncDirection" value="local-to-gas" />
                    ローカルからGASへ上書き
                </label>
                <label>
                    <input type="radio" v-model="syncDirection" value="gas-to-local" />
                    GASからローカルへ上書き (完全上書き)
                </label>
            </div>

            <div class="section">
                <label><input type="checkbox" v-model="backupBeforeSync" /> 同期前にローカルのバックアップをダウンロードする (推奨)</label>
                <label><input type="checkbox" v-model="includeAssetsInBackup" /> バックアップにアセットを含める</label>
            </div>

            <div v-if="syncDirection === 'gas-to-local'" class="warning">
                <p>注意: GAS→ローカル はローカルデータを完全に上書きします。</p>
                <label><input type="checkbox" v-model="ackCheck" /> 上書きに同意します</label>
                <label>確認フレーズを入力してください: <input type="text" v-model="confirmPhrase" placeholder="上書きする" /></label>
            </div>

            <div class="actions">
                <button class="primary" @click="onExecute" :disabled="isExecuting || !canExecute">実行</button>
                <button @click="onClose" :disabled="isExecuting">キャンセル</button>
            </div>

            <div v-if="isExecuting" class="progress">
                <div class="progress-bar">
                    <div class="progress-inner" :style="{ width: progressPercent + '%' }"></div>
                </div>
                <div class="progress-steps">
                    <div v-for="(line, idx) in logs" :key="idx" class="log-line">{{ line }}</div>
                </div>
                <div class="progress-controls">
                    <button @click="onCancel">キャンセル要求</button>
                </div>
            </div>

            <div v-if="resultMessage" class="result">{{ resultMessage }}</div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { container } from 'tsyringe';
import { BulkSyncService } from '../../../../model/applications/bulk-sync/bulk-sync-service';

const props = defineProps<{ visible: boolean }>();
const emit = defineEmits(['close']);

const visible = computed(() => props.visible);
const syncDirection = ref<'local-to-gas' | 'gas-to-local'>('local-to-gas');
const backupBeforeSync = ref(true);
const includeAssetsInBackup = ref(true);
const ackCheck = ref(false);
const confirmPhrase = ref('');

const isExecuting = ref(false);
const logs = ref<string[]>([]);
const progressPercent = ref(0);
const resultMessage = ref('');

const CONFIRMATION_PHRASE = '上書きする';

const bulkService = container.resolve(BulkSyncService);

const canExecute = computed(() => {
    if (isExecuting.value) return false;
    if (syncDirection.value === 'gas-to-local') {
        return ackCheck.value && confirmPhrase.value === CONFIRMATION_PHRASE;
    }
    return true;
});

function appendLog(msg: string) {
    logs.value.push(msg);
    // keep latest 200 lines
    if (logs.value.length > 200) logs.value.shift();
}

async function onExecute() {
    if (!canExecute.value) return;
    isExecuting.value = true;
    logs.value = [];
    progressPercent.value = 0;
    resultMessage.value = '';

    try {
        await bulkService.sync(syncDirection.value, {
            backup: backupBeforeSync.value,
            includeAssetsInBackup: includeAssetsInBackup.value,
        }, (stage, status, detail, percent) => {
            const txt = `[${stage}] ${status}${detail ? ': ' + detail : ''}`;
            appendLog(txt);
            if (typeof percent === 'number') progressPercent.value = Math.max(0, Math.min(100, percent));
        });
        resultMessage.value = '同期が完了しました';
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        appendLog('ERROR: ' + msg);
        resultMessage.value = '同期に失敗しました: ' + msg;
    } finally {
        isExecuting.value = false;
    }
}

function onClose() {
    emit('close');
}

function onCancel() {
    appendLog('キャンセル要求を送信しました。処理を中断します...');
    bulkService.requestCancel();
}
</script>

<style scoped>
.bulk-sync-overlay {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.5);
    z-index: 2000;
}

.bulk-sync-dialog {
    background: #232b36;
    color: #fff;
    padding: 20px;
    border-radius: 8px;
    width: 520px;
    max-height: 80vh;
    overflow: auto
}

.section {
    margin: 10px 0
}

.warning {
    background: #5a1b1b;
    padding: 10px;
    border-radius: 6px;
    color: #ffdede;
    margin-bottom: 10px
}

.actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    margin-top: 12px
}

.primary {
    background: #4f8cff;
    color: #232b36;
    padding: 8px 14px;
    border-radius: 6px;
}

.progress {
    margin-top: 12px
}

.progress-bar {
    background: #111;
    height: 8px;
    border-radius: 4px;
    overflow: hidden
}

.progress-inner {
    background: linear-gradient(90deg, #4f8cff, #aee1ff);
    height: 100%;
    width: 0
}

.log-line {
    font-size: 12px;
    color: #dfefff;
    margin-top: 6px
}

.result {
    margin-top: 12px;
    font-weight: 600
}
</style>
