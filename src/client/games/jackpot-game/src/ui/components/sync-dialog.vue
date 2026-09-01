<template>
    <div class="modal-overlay sync-modal">
        <div class="modal-box">
            <h2 class="modal-title">一括同期</h2>

            <div class="sync-options" v-if="!running">
                <div style="margin-bottom:12px;">
                    <label><input type="radio" v-model="direction" value="download" /> Drive → ローカル (ダウンロード)</label>
                    <label style="margin-left:12px;"><input type="radio" v-model="direction" value="upload" /> ローカル →
                        Drive (アップロード)</label>
                </div>
                <div style="margin-bottom:12px;">
                    <label><input type="checkbox" v-model="createBackup" /> 同期前にバックアップを作成してダウンロード</label>
                </div>
                <div class="modal-actions">
                    <button class="admin-btn cancel-primary" @click="$emit('close')">閉じる</button>
                    <button class="admin-btn" @click="start" :disabled="running">同期開始</button>
                </div>
            </div>

            <div v-else>
                <h3 class="modal-subtitle">同期中・・・</h3>
                <div class="sync-item" v-for="d in domains" :key="d.id">
                    <div class="label">{{ d.label }}</div>
                    <div class="progress-bar-outer">
                        <div class="progress-bar-inner" :style="{ width: d.progress + '%' }"></div>
                    </div>
                    <div class="status">{{ d.message }}</div>
                </div>

                <div class="modal-actions">
                    <button class="admin-btn cancel-primary" v-if="!finished" @click="cancel">キャンセル</button>
                    <button class="admin-btn" v-if="finished" @click="$emit('close')">閉じる</button>
                </div>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue';
import { container } from 'tsyringe';
import BulkSyncService from '../../model/applications/bulk-sync/bulk-sync-service';
import { exportLocalBackup } from '../../model/applications/bulk-sync/backup-util';

const domains = reactive([
    { id: 'members', label: 'メンバー設定', progress: 0, message: '準備中...', running: false },
    { id: 'prizes', label: '景品設定', progress: 0, message: '準備中...', running: false },
    { id: 'assets', label: 'アセットデータ', progress: 0, message: '準備中...', running: false },
    { id: 'screens', label: '画面設定', progress: 0, message: '準備中...', running: false }
]);

const finished = ref(false);
const cancelled = ref(false);
const running = ref(false);
const direction = ref<'download' | 'upload'>('download');
const createBackup = ref(true);

const bulkSync = container.resolve(BulkSyncService as any);

function updateDomain(id: string, patch: Partial<any>) {
    const d = domains.find((x: any) => x.id === id) as any;
    if (!d) return;
    Object.assign(d, patch);
}

async function syncMembers() {
    const id = 'members';
    updateDomain(id, { running: true, message: 'ファイルダウンロード中...' });
    try {

        const lastId = localStorage.getItem('jackpot-members-last-file-id');
        if (!lastId) {
            updateDomain(id, { message: 'Drive 上のメンバーファイルが見つかりません', progress: 100 });
            return;
        }

        const service = new GasFunctionService('jackpotGame_getJson');
        const resp = await service.call<{ json: string }>(lastId);
        if (resp && resp.json) {
            updateDomain(id, { message: 'ダウンロード完了、保存中...', progress: 80 });
            try {
                const parsed = JSON.parse(resp.json || '[]');
                if (Array.isArray(parsed)) {
                    await memberRepo.replaceAllMembers(parsed as any);
                    updateDomain(id, { message: '同期完了', progress: 100 });
                } else {
                    updateDomain(id, { message: 'ダウンロードした JSON が配列ではありません', progress: 100 });
                }
            } catch (e) {
                updateDomain(id, { message: '保存に失敗しました', progress: 100 });
                console.error(e);
            }
        } else {
            updateDomain(id, { message: 'Drive からの取得に失敗しました', progress: 100 });
        }
    } catch (e) {
        console.error('members sync error', e);
        updateDomain(id, { message: '同期に失敗しました', progress: 100 });
    }
}

async function syncPrizes() {
    const id = 'prizes';
    updateDomain(id, { running: true, message: 'ファイルダウンロード中...' });
    try {
        await prizeRepo.importAllPrizesFromDrive();
        updateDomain(id, { message: 'ダウンロード完了、保存中...', progress: 80 });
        updateDomain(id, { message: '同期完了', progress: 100 });
    } catch (e) {
        console.error('prizes sync error', e);
        updateDomain(id, { message: 'Drive 上の景品ファイルが見つからないか取得に失敗しました', progress: 100 });
    }
}

async function syncAssets() {
    const id = 'assets';
    updateDomain(id, { running: true, message: 'ファイルメタデータ取得中...', progress: 10 });
    try {

        if (typeof (assetDataService as any).replaceLocalWithDrive === 'function') {
            await (assetDataService as any).replaceLocalWithDrive((msg: string) => {



                const m = msg.match(/(\d+)\/(\d+)/);
                if (m) {
                    const cur = Number(m[1]);
                    const total = Number(m[2]);
                    const p = Math.round((cur / Math.max(1, total)) * 100);
                    updateDomain(id, { message: `ファイルダウンロード中: ${total}件中${cur}件完了...`, progress: p });
                } else {

                    updateDomain(id, { message: msg });
                }
            });
            updateDomain(id, { message: '同期完了', progress: 100 });
        } else {
            updateDomain(id, { message: 'アセット同期機能が利用できません', progress: 100 });
        }
    } catch (e) {
        console.error('assets sync error', e);
        updateDomain(id, { message: '同期に失敗しました', progress: 100 });
    }
}

async function syncScreens() {
    const id = 'screens';
    updateDomain(id, { running: true, message: '画面設定を同期中...', progress: 20 });
    try {
        updateDomain(id, { message: '同期完了', progress: 100 });
    } catch (e) {
        console.error('screen sync error', e);
        updateDomain(id, { message: '同期に失敗しました', progress: 100 });
    }
}

function startAll() {
    finished.value = false;
    cancelled.value = false;
    // kept for compatibility
    start();
}

async function start() {
    finished.value = false;
    cancelled.value = false;
    running.value = true;
    // optional backup before upload
    try {
        if (direction.value === 'upload' && createBackup.value) {
            await exportLocalBackup(true);
        }
    } catch (e) {
        console.error('Backup failed', e);
    }

    bulkSync
        .syncDirection(direction.value, (domainId: string, message: string, progress?: number) => {
            const p = progress ?? (message === '同期完了' || message === 'アップロード完了' ? 100 : 50);
            updateDomain(domainId, { message, progress: p });
        })
        .then(() => {
            finished.value = true;
            running.value = false;
            for (const d of domains) {
                if (d.progress < 100) d.progress = 100;
                if (!d.message || d.message === '準備中...') d.message = '同期完了';
            }
        })
        .catch((e: any) => {
            console.error('Bulk sync failed', e);
            finished.value = true;
            running.value = false;
        });
}

function cancel() {
    bulkSync.requestCancel();
    for (const d of domains) {
        if (d.progress < 100) d.message = 'キャンセルされました';
    }
    finished.value = true;
    running.value = false;
}

// start is triggered by user action
</script>

<style scoped>
.modal-overlay.sync-modal {
    position: fixed;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    z-index: 1200;
}

.modal-box {
    background: #0f0f0f;
    color: #fff;
    border: 1px solid #cfcfcf;
    padding: 28px;
    width: 760px;
    box-sizing: border-box;
}

.modal-title {
    text-align: center;
    margin: 0 0 18px 0;
}

.sync-item {
    margin-bottom: 18px;
}

.label {
    margin-bottom: 8px;
    font-weight: 700;
}

.progress-bar-outer {
    background: #222;
    height: 14px;
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.06);
}

.progress-bar-inner {
    background: #fff;
    height: 100%;
    width: 0%;
    transition: width 300ms ease;
}

.status {
    margin-top: 8px;
    color: #cfcfcf;
    font-size: 0.9rem;
}

.modal-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 14px;
}

.admin-btn {
    padding: 8px 16px;
    border-radius: 6px;
    border: none;
    background: linear-gradient(90deg, #4f8cff 0%, #aee1ff 100%);
    color: #232b36;
    font-weight: 700;
    cursor: pointer;
}

.cancel-primary {
    background: #3b4650;
    color: #fff;
}
</style>
