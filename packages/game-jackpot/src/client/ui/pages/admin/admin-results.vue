<template>
    <div class="admin-section">
        <UiToolbar>
            <label class="session-picker">
                結果の保存先
                <select v-model="selected" data-testid="results-source" @change="fetchData">
                    <option v-for="s in sessions" :key="s.id" :value="s.id">{{ s.name }}{{ s.mode === 'demo' ? '(デモ)' : '' }}{{ s.status === 'closed' ? '(終了)' : '' }}</option>
                    <option :value="REHEARSAL">リハーサル(このブラウザのメモリ。結果は保存されません)</option>
                </select>
            </label>
            <UiButton @click="fetchData">読み直す</UiButton>
            <UiButton variant="danger" icon="restore" @click="openResetModal">結果をリセット</UiButton>
        </UiToolbar>
        <p v-if="errorMessage" class="results-error" role="alert" data-testid="results-error">{{ errorMessage }}</p>

        <div class="results-summary">
            <div class="summary-item">
                <h3>総抽選回数</h3>
                <p data-testid="total-draws">{{ totalDraws }}</p>
            </div>
            <div class="summary-item">
                <h3>当選者数</h3>
                <p>{{ winnersCount }}</p>
            </div>
            <div class="summary-item">
                <h3>景品残数</h3>
                <p>{{ remainingPrizes }}</p>
            </div>
        </div>

        <h3>抽選結果一覧</h3>
        <DataTable :columns="drawColumns" :rows="drawRows" row-key="drawId" empty-text="抽選結果はありません">
            <template #cell-status="{ row }">
                <span class="winner-badge">当選</span>
                <span v-if="row.isKakuhen" class="kakuhen-badge">確変</span>
                <span v-if="!row.revealed" class="reserved-badge">未公開</span>
            </template>
        </DataTable>

        <h3>メンバー当選状況</h3>
        <DataTable :columns="memberColumns" :rows="memberStats" row-key="id" empty-text="メンバー当選状況はありません">
            <template #cell-photo="{ row }">
                <div class="member-preview">
                    <img v-if="row.photoAssetId && imageUrls.get(row.photoAssetId)" :src="imageUrls.get(row.photoAssetId)!" alt="photo"
                        class="preview-img" />
                    <span v-else>写真なし</span>
                </div>
            </template>
            <template #cell-wins="{ row }">{{ row.wins }}回</template>
        </DataTable>

        <h3>景品当選状況</h3>
        <DataTable :columns="prizeColumns" :rows="prizeStats" row-key="id" empty-text="景品当選状況はありません">
            <template #cell-image="{ row }">
                <div class="prize-preview">
                    <img v-if="row.imageAssetId && imageUrls.get(row.imageAssetId)" :src="imageUrls.get(row.imageAssetId)!" alt="image"
                        class="preview-img" />
                    <span v-else>画像なし</span>
                </div>
            </template>
            <template #cell-reserved="{ row }">
                <span v-if="row.reserved" class="reserved-badge" data-testid="reserved-badge">確変用に取り置き</span>
            </template>
        </DataTable>
    </div>

    <UiDialog :model-value="showResetModal" title="抽選結果をリセット" size="sm" danger confirm-label="リセット"
        @confirm="confirmReset" @close="showResetModal = false">
        <p class="message">選んだ保存先の抽選結果と確変の予定を削除します(参加者のポータルの当選履歴も消えます)。この操作は取り消せません。続行しますか？</p>
    </UiDialog>
</template>

<script setup lang="ts">
import { DataTable, UiButton, UiDialog, UiToolbar } from '@octopus/ui-kit';
import type { DataTableColumn } from '@octopus/ui-kit';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { container } from 'tsyringe';
import { HostAgent, ISessionHubApiToken } from '@octopus/session-hub';
import type { JackpotState, SessionHubApi, SessionSummary } from '@octopus/session-hub';
import type { Prize } from '../../../model/prize/prize';
import type { MemberDto } from '@control/member/dto/member-dto';
import { MemberRepository } from '@model/member/member-repository';
import { PrizeRepository } from '@model/prize/prize-repository';
import { AssetDataService } from '@control/asset/asset-data-service';
import { DrawStoreProvider } from '@control/draw/draw-store-provider';

/** 結果の保存先の選択肢「リハーサル」の値。 */
const REHEARSAL = '';

/** 表示用の1行(サーバーの JackpotDraw と、メモリのリハーサルの両方をこの形にする)。 */
interface Row {
    drawId: string;
    memberId: string;
    memberName: string;
    prizeId: string;
    prizeName: string;
    isKakuhen: boolean;
    atMs: number;
    revealed: boolean;
}

const memberRepo = container.resolve(MemberRepository);
const prizeRepo = container.resolve(PrizeRepository);
const assetService = container.resolve(AssetDataService);
const drawStores = container.resolve(DrawStoreProvider);
const hubApi = (): SessionHubApi | null => (container.isRegistered(ISessionHubApiToken) ? container.resolve<SessionHubApi>(ISessionHubApiToken) : null);
const hostAgent = (): HostAgent | null => (container.isRegistered(HostAgent) ? container.resolve(HostAgent) : null);

const sessions = ref<SessionSummary[]>([]);
const selected = ref<string>(REHEARSAL);
const draws = ref<Row[]>([]);
const reservedPrizeIds = ref<string[]>([]);
const prizes = ref<Prize[]>([]);
const members = ref<MemberDto[]>([]);
const showResetModal = ref(false);
const errorMessage = ref<string | null>(null);
const imageUrls = ref(new Map<string, string>());

const drawColumns: DataTableColumn[] = [
    { key: 'memberName', label: 'メンバー' },
    { key: 'prizeName', label: '景品' },
    { key: 'status', label: 'ステータス' },
    { key: 'at', label: '日時' },
];
const memberColumns: DataTableColumn[] = [
    { key: 'name', label: 'メンバー' },
    { key: 'photo', label: '写真' },
    { key: 'wins', label: '当選回数' },
];
const prizeColumns: DataTableColumn[] = [
    { key: 'name', label: '景品' },
    { key: 'image', label: '画像' },
    { key: 'wins', label: '当選回数' },
    { key: 'remaining', label: '残り' },
    { key: 'reserved', label: '取り置き' },
];

const formatDate = (atMs: number) => {
    const date = new Date(atMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const drawRows = computed(() => draws.value.map(r => ({ ...r, at: formatDate(r.atMs) })));

const totalDraws = computed(() => draws.value.length);
const winnersCount = computed(() => new Set(draws.value.map(r => r.memberId)).size);
const remainingPrizes = computed(() => {
    const won = new Set(draws.value.map(r => r.prizeId));
    return prizes.value.filter(p => !won.has(p.id)).length;
});

const memberStats = computed(() =>
    members.value.map(member => ({ ...member, wins: draws.value.filter(r => r.memberId === member.id).length }))
);

const prizeStats = computed(() =>
    prizes.value.map(prize => {
        const wins = draws.value.filter(r => r.prizeId === prize.id).length;
        return { ...prize, wins, remaining: wins > 0 ? 0 : 1, reserved: reservedPrizeIds.value.includes(prize.id) };
    })
);

const loadImage = async (assetId?: string) => {
    if (!assetId || imageUrls.value.has(assetId)) return;
    try {
        const asset = await assetService.getAssetDataById(assetId);
        if (asset?.blob) {
            imageUrls.value.set(assetId, URL.createObjectURL(asset.blob));
        }
    } catch (error) {
        console.error('Failed to load image:', error);
    }
};

const openResetModal = () => {
    showResetModal.value = true;
};

const fromState = (state: JackpotState) => {
    draws.value = state.draws.map(d => ({ ...d, revealed: d.revealedAtMs !== null }));
    reservedPrizeIds.value = state.plan?.reservedPrizeIds ?? [];
};

/** 選んだ保存先(セッションの結果ファイル / リハーサル)の抽選状態を読む。 */
const loadJackpot = async () => {
    if (selected.value === REHEARSAL) {
        const store = drawStores.rehearsal();
        draws.value = (await store.results()).map(r => ({
            drawId: r.drawId, memberId: r.wonMember?.id ?? '', memberName: r.wonMember?.name ?? '不明',
            prizeId: r.wonPrize?.id ?? '', prizeName: r.wonPrize?.name ?? '不明', isKakuhen: r.isKakuhen, atMs: r.createdAt, revealed: true,
        }));
        reservedPrizeIds.value = (await store.plan())?.reservedPrizeIds ?? [];
        return;
    }
    const api = hubApi();
    if (!api) throw new Error('セッションに接続できません');
    fromState(await api.getJackpotState({ sessionId: selected.value }));
};

const fetchData = async () => {
    errorMessage.value = null;
    try {
        await loadJackpot();
        prizes.value = await prizeRepo.getPrizes();
        members.value = await memberRepo.getMembers();
    } catch (error) {
        console.error('Failed to fetch data:', error);
        errorMessage.value = `結果を読み込めませんでした: ${(error as Error)?.message ?? error}`;
    }
};

const confirmReset = async () => {
    try {
        if (selected.value === REHEARSAL) {
            await drawStores.rehearsal().reset();
        } else {
            const agent = hostAgent();
            // このホスト端末が接続しているセッションなら、参加者への通知(rev)とメモリの状態も合わせて更新する
            if (agent?.active && agent.connection.state.session?.id === selected.value) await agent.resetJackpot();
            else await hubApi()!.resetJackpot({ sessionId: selected.value });
            await drawStores.current().load().catch(() => undefined);
        }
        await fetchData();
        showResetModal.value = false;
    } catch (error) {
        console.error('Failed to reset draw results:', error);
        errorMessage.value = `リセットできませんでした: ${(error as Error)?.message ?? error}`;
    }
};

onMounted(async () => {
    try {
        sessions.value = (await hubApi()?.listSessions()) ?? [];
    } catch (error) {
        console.error('Failed to list sessions:', error);
    }
    // 既定は、このホスト端末が接続しているセッション。無ければ進行中の最初のセッション、それも無ければリハーサル
    const agent = hostAgent();
    const hosted = agent?.active ? agent.connection.state.session?.id : undefined;
    selected.value = hosted ?? sessions.value.find(s => s.status !== 'closed')?.id ?? REHEARSAL;
    await fetchData();
    await Promise.all([
        ...members.value.map(m => loadImage(m.photoAssetId)),
        ...prizes.value.map(p => loadImage(p.imageAssetId)),
    ]);
});

onUnmounted(() => {
    // Clean up object URLs to prevent memory leaks
    for (const objectUrl of imageUrls.value.values()) {
        try {
            URL.revokeObjectURL(objectUrl);
        } catch (e) {
            // Ignore errors
        }
    }
    imageUrls.value.clear();
});
</script>

<style scoped>
.session-picker {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1 1 auto;
    min-width: 0;
}

.session-picker select {
    min-width: 0;
    max-width: 100%;
}

.results-error {
    color: var(--ui-danger, #e5484d);
}

.results-summary {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 20px;
}

.summary-item {
    background: var(--ui-surface, #2b3036);
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    flex: 1 1 120px;
}

.summary-item h3 {
    margin: 0 0 10px 0;
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.summary-item p {
    margin: 0;
    font-size: var(--ui-font-xl, 1.5rem);
    font-weight: bold;
    color: var(--ui-text, #fff);
}

.result-info {
    display: flex;
    align-items: center;
    gap: 10px;
}

.member {
    font-weight: bold;
}

.arrow {
    color: var(--ui-text-muted, #cfd6dd);
}

.prize {
    font-weight: bold;
    color: var(--ui-danger, #e5484d);
}

.winner-badge {
    background: var(--ui-accent, #aee1ff);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: var(--ui-font-xs, 0.75rem);
}

.kakuhen-badge {
    background: var(--ui-danger, #e5484d);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: var(--ui-font-xs, 0.75rem);
}

.reserved-badge {
    background: var(--ui-success, #3fb27f);
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: var(--ui-font-xs, 0.75rem);
}

.result-meta {
    text-align: right;
    color: var(--ui-text-muted, #cfd6dd);
}

.stat-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.stat-count {
    color: var(--ui-text-muted, #cfd6dd);
    font-size: var(--ui-font-sm, 0.875rem);
}

.preview-img {
    max-width: 50px;
    max-height: 50px;
    border-radius: 4px;
}

.admin-table {
    width: 100%;
    border-collapse: collapse;
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text, #fff);
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.admin-table th,
.admin-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid var(--ui-border, #3a4048);
}

.admin-table th {
    background: var(--ui-surface, #2b3036);
    color: var(--ui-text-muted, #cfd6dd);
    font-weight: 600;
}

.admin-table tr:hover {
    background: rgba(255, 255, 255, 0.02);
}

.prize-preview {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ui-surface, #2b3036);
    border-radius: 6px;
    overflow: hidden;
}

.member-preview {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--ui-surface, #2b3036);
    border-radius: 6px;
    overflow: hidden;
}
</style>