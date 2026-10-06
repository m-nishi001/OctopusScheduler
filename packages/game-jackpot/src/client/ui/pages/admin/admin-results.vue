<template>
    <div class="admin-section">
        <UiToolbar>
            <UiButton variant="danger" icon="restore" @click="openResetModal">結果をリセット</UiButton>
        </UiToolbar>

        <div class="results-summary">
            <div class="summary-item">
                <h3>総抽選回数</h3>
                <p>{{ totalDraws }}</p>
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
        <table v-if="drawResults.length" class="admin-table">
            <thead>
                <tr>
                    <th>メンバー</th>
                    <th>景品</th>
                    <th>ステータス</th>
                    <th>日時</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="result in drawResults" :key="result.drawId">
                    <td>{{ result.wonMember?.name || '不明' }}</td>
                    <td>{{ result.wonPrize?.name || '不明' }}</td>
                    <td>
                        <span v-if="result.wonMember !== null" class="winner-badge">当選</span>
                        <span v-if="result.isKakuhen" class="kakuhen-badge">確変</span>
                        <span v-if="result.wonMember === null" class="reserved-badge">予約</span>
                    </td>
                    <td>{{ formatDate(result) }}</td>
                </tr>
            </tbody>
        </table>
        <div v-else class="empty-state">
            抽選結果はありません
        </div>

        <h3>メンバー当選状況</h3>
        <table v-if="members.length" class="admin-table">
            <thead>
                <tr>
                    <th>メンバー</th>
                    <th>写真</th>
                    <th>当選回数</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="stat in memberStats" :key="stat.id">
                    <td>{{ stat.name }}</td>
                    <td>
                        <div class="member-preview">
                            <img v-if="stat.photoAssetId && imageUrls.get(stat.photoAssetId)"
                                :src="imageUrls.get(stat.photoAssetId)!" alt="photo" class="preview-img" />
                            <span v-else>写真なし</span>
                        </div>
                    </td>
                    <td>{{ stat.wins }}回</td>
                </tr>
            </tbody>
        </table>
        <div v-else class="empty-state">
            メンバー当選状況はありません
        </div>

        <h3>景品当選状況</h3>
        <table v-if="prizes.length" class="admin-table">
            <thead>
                <tr>
                    <th>景品</th>
                    <th>画像</th>
                    <th>当選回数</th>
                    <th>残り</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="stat in prizeStats" :key="stat.id">
                    <td>{{ stat.name }}</td>
                    <td>
                        <div class="prize-preview">
                            <img v-if="stat.imageAssetId && imageUrls.get(stat.imageAssetId)"
                                :src="imageUrls.get(stat.imageAssetId)!" alt="image" class="preview-img" />
                            <span v-else>画像なし</span>
                        </div>
                    </td>
                    <td>{{ stat.wins }}</td>
                    <td>{{ stat.remaining }}</td>
                </tr>
            </tbody>
        </table>
        <div v-else class="empty-state">
            景品当選状況はありません
        </div>
    </div>

    <UiDialog :model-value="showResetModal" title="抽選結果をリセット" size="sm" danger confirm-label="リセット"
        @confirm="confirmReset" @close="showResetModal = false">
        <p class="message">全ての抽選結果を削除し、景品の当選フラグをリセットします。この操作は取り消せません。続行しますか？</p>
    </UiDialog>
</template>

<script setup lang="ts">
import { UiButton, UiDialog, UiToolbar } from '@octopus/ui-kit';
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { container } from 'tsyringe';
import { DrawResultService } from '@control/draw/draw-result-service';
import { PrizeService } from '@control/prize/prize-service';
import type { DrawResultDto } from '@control/draw/dto/draw-result-dto';
import type { Prize } from '../../../model/prize/prize';
import type { MemberDto } from '@control/member/dto/member-dto';
import { MemberRepository } from '@model/member/member-repository';
import { PrizeRepository } from '@model/prize/prize-repository';
import { AssetDataService } from '@control/asset/asset-data-service';
import { PrizeDrawStateRepository } from '@model/draw/prize-draw-state-repository';

const drawResultService = container.resolve(DrawResultService);
const prizeService = container.resolve(PrizeService);
const memberRepo = container.resolve(MemberRepository);
const prizeRepo = container.resolve(PrizeRepository);
const assetService = container.resolve(AssetDataService);
const prizeDrawStateRepository = container.resolve<PrizeDrawStateRepository>(PrizeDrawStateRepository);

const drawResults = ref<DrawResultDto[]>([]);
const prizes = ref<Prize[]>([]);
const members = ref<MemberDto[]>([]);
const showResetModal = ref(false);
const imageUrls = ref(new Map<string, string>());

const totalDraws = computed(() => drawResults.value.length);
const winnersCount = computed(() => drawResults.value.filter(r => r.wonMember !== null).length);
const remainingPrizes = computed(() => {
    const assignedPrizeIds = new Set(drawResults.value.filter(r => r.wonMember !== null).map(r => r.wonPrize?.id).filter(Boolean));
    return prizes.value.length - assignedPrizeIds.size;
});

const memberStats = computed(() => {
    const stats = members.value.map(member => {
        const wins = drawResults.value.filter(r => r.wonMember?.id === member.id).length;
        return {
            ...member,
            wins
        };
    });
    return stats;
});

const prizeStats = computed(() => {
    const stats = prizes.value.map(prize => {
        const wins = drawResults.value.filter(r => r.wonPrize?.id === prize.id).length;
        const remaining = drawResults.value.some(r => r.wonPrize?.id === prize.id && r.wonMember !== null) ? 0 : 1;
        return {
            ...prize,
            wins,
            remaining
        };
    });
    return stats;
}); const formatDate = (result: DrawResultDto) => {
    const date = new Date(result.createdAt);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
};

const loadImage = async (assetId?: string) => {
    if (!assetId || imageUrls.value.has(assetId)) return;
    try {
        const asset = await assetService.getAssetDataById(assetId);
        if (asset?.blob) {
            const objectUrl = URL.createObjectURL(asset.blob);
            imageUrls.value.set(assetId, objectUrl);
        }
    } catch (error) {
        console.error('Failed to load image:', error);
    }
};

const openResetModal = () => {
    showResetModal.value = true;
};

const confirmReset = async () => {
    try {
        await Promise.all(drawResults.value.map(result => drawResultService.deleteDrawResult(result.drawId)));
        await prizeService.resetAllAssigned();
        await prizeDrawStateRepository.clearState();
        await fetchData();
        showResetModal.value = false;
    } catch (error) {
        console.error('Failed to reset draw results:', error);
    }
};

const fetchData = async () => {
    try {
        drawResults.value = await drawResultService.getDrawResults();
        prizes.value = await prizeRepo.getPrizes();
        members.value = await memberRepo.getMembers();
        console.log("[AdminResults] fetchData: drawResults", drawResults.value.length, "prizes", prizes.value.length, "members", members.value.length);
        console.log("[AdminResults] drawResults sample:", drawResults.value.slice(0, 5).map(r => ({ drawId: r.drawId, wonMember: r.wonMember, wonPrizeId: r.wonPrize?.id, isKakuhen: r.isKakuhen })));
    } catch (error) {
        console.error('Failed to fetch data:', error);
    }
};

onMounted(async () => {
    await fetchData();
    const promises = [];
    for (const member of members.value) {
        if (member.photoAssetId) promises.push(loadImage(member.photoAssetId));
    }
    for (const prize of prizes.value) {
        if (prize.imageAssetId) promises.push(loadImage(prize.imageAssetId));
    }
    await Promise.all(promises);
    // Add storage event listener for debugging
    window.addEventListener('storage', (event) => {
        console.log("[AdminResults] storage event detected:", event.key, event.newValue);
        fetchData();
    });
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
.results-summary {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
}

.summary-item {
    background: var(--ui-surface, #2b3036);
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    flex: 1;
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