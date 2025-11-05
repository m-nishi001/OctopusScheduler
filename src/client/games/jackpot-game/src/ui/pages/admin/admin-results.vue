<template>
    <div class="admin-section">
        <h2>抽選結果管理</h2>
        <div class="admin-actions">
            <button class="admin-btn icon-only reset-icon" @click="openResetModal" title="Reset all draw results">
                <span class="emoji">♻️</span>
            </button>
        </div>

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

    <div v-if="showResetModal" class="modal-overlay">
        <div class="modal-content">
            <h3>抽選結果をリセット</h3>
            <p>全ての抽選結果を削除し、景品の当選フラグをリセットします。この操作は取り消せません。続行しますか？</p>
            <div class="modal-actions">
                <button class="admin-btn delete-btn" @click="confirmReset">リセット</button>
                <button class="admin-btn" @click="showResetModal = false">キャンセル</button>
            </div>
        </div>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { container } from 'tsyringe';
import { DrawResultService } from '@model/applications/draw/draw-result-service';
import { PrizeService } from '@model/applications/prize/prize-service';
import type { DrawResultDto } from '@model/applications/draw/dto/draw-result-dto';
import type { Prize } from '../../../model/domains/prize/prize';
import type { MemberDto } from '@model/applications/member/dto/member-dto';
import { IPrizeRepositoryToken } from '@model/domains/prize/repository/i-prize-repository';
import { IMemberRepositoryToken } from '@model/domains/member/repository/i-member-repository';
import type { IPrizeRepository } from '@model/domains/prize/repository/i-prize-repository';
import type { IMemberRepository } from '@model/domains/member/repository/i-member-repository';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { PrizeDrawStateRepository } from '@model/infrastructures/prize-draw-state-repository';

const drawResultService = container.resolve(DrawResultService);
const prizeService = container.resolve(PrizeService);
const memberRepo = container.resolve<IMemberRepository>(IMemberRepositoryToken);
const prizeRepo = container.resolve<IPrizeRepository>(IPrizeRepositoryToken);
const assetService = container.resolve(AssetDataService);
const prizeDrawStateRepository = container.resolve(PrizeDrawStateRepository);

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
    background: #2a3137;
    padding: 15px;
    border-radius: 8px;
    text-align: center;
    flex: 1;
}

.summary-item h3 {
    margin: 0 0 10px 0;
    color: #cfe8ff;
    font-size: 0.9rem;
}

.summary-item p {
    margin: 0;
    font-size: 1.5rem;
    font-weight: bold;
    color: #fff;
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
    color: #666;
}

.prize {
    font-weight: bold;
    color: #ff6b6b;
}

.winner-badge {
    background: #4f8cff;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
}

.kakuhen-badge {
    background: #ff6b6b;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
}

.reserved-badge {
    background: #28a745;
    color: white;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.8rem;
}

.result-meta {
    text-align: right;
    color: #999;
}

.stat-info {
    display: flex;
    flex-direction: column;
    gap: 5px;
}

.stat-count {
    color: #cfe8ff;
    font-size: 0.9rem;
}

.preview-img {
    max-width: 50px;
    max-height: 50px;
    border-radius: 4px;
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
    padding: 24px;
}

.modal-overlay::-webkit-scrollbar {
    width: 0;
    height: 0;
}

.modal-content {
    background: #232b36;
    color: #fff;
    padding: 28px;
    border-radius: 10px;
    text-align: left;
    box-shadow: 0 6px 28px rgba(0, 0, 0, 0.36);
    max-width: 620px;
    width: 90%;
}

.modal-actions {
    margin-top: 16px;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.admin-table {
    width: 100%;
    border-collapse: collapse;
    background: #232b36;
    color: #fff;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
}

.admin-table th,
.admin-table td {
    padding: 12px;
    text-align: left;
    border-bottom: 1px solid #2a3137;
}

.admin-table th {
    background: #2a3137;
    color: #cfe8ff;
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
    background: #2a3137;
    border-radius: 6px;
    overflow: hidden;
}

.member-preview {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #2a3137;
    border-radius: 6px;
    overflow: hidden;
}
</style>