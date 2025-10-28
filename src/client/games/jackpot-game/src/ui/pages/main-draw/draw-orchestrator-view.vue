<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">

            <DrawResultDialog v-if="showEndModal" title="抽選は終了しました" :message="'全ての景品が配布されました。Enter を押すと結果画面へ移動します。'"
                @close="closeModal" />

            <DrawResultDialog v-if="showHalfModal" title="残り半分です！" :message="'景品の残りが半分になりました。Enter を押すと続行します。'"
                @close="closeModal" />

            <DrawResultDialog v-if="showPrizeWinnerModal" title="景品当選" :assetId="latestResult?.prize?.imageAssetId"
                primaryLabel="次へ" @close="closeModal">
                当選景品: <strong>{{ latestResult?.prize?.name }}</strong>
            </DrawResultDialog>

            <div class="rich-layout">
                <section class="member-area-fullscreen" v-if="currentPhase === 'member'">
                    <div class="member-stage-fullscreen">
                        <MemberDrawAnimation ref="memberAnimRef" :members="members" :externalDialog="false"
                            @start="() => { void memberStart(); }" @close-winner-dialog="closeModal" />
                    </div>
                </section>

                <section v-if="currentPhase === 'prize'"
                    class="center-area grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
                    <div class="result-panel col-span-1 md:col-span-1 bg-white/80 rounded p-4 shadow">
                        <h4 class="font-semibold mb-2">直近の当選</h4>
                        <div v-if="latestResult">
                            <p class="text-sm">メンバー: <strong>{{ latestResult.member?.name }}</strong></p>
                            <p class="text-sm">景品: <strong>{{ latestResult.prize?.name || '（未決定）' }}</strong></p>
                        </div>
                        <div v-else class="text-sm text-gray-500">まだ抽選が実行されていません。開始ボタン、または Enter を押してください。</div>
                    </div>

                    <div class="roulette-panel col-span-1 md:col-span-1 flex items-center justify-center"
                        v-if="currentPhase === 'prize'">
                        <RouletteAnimation ref="rouletteRef" :prizes="prizes" :selectedPrize="selectedPrize"
                            :showResult="showPrizeResult" @stopped="onRouletteStopped" />
                    </div>

                    <div class="guide-panel col-span-1 md:col-span-1 bg-white/80 rounded p-4 shadow">
                        <h4 class="font-semibold mb-2">操作ガイド</h4>
                        <ul class="text-sm list-disc pl-5 text-gray-700">
                            <li>Enter: 抽選開始 / 停止 / 続行</li>
                            <li>最初にメンバー抽選 → 次に景品抽選 の順。</li>
                            <li>残り半分になると警告モーダルが表示されます。</li>
                        </ul>
                    </div>
                </section>
            </div>

        </div>
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation, { type MemberAnimRef } from './member-draw-animation.vue';
import RouletteAnimation, { type RouletteRef } from './roulette-animation.vue';
import DrawResultDialog from './prize-winning-dialog.vue';
import { DrawApplicationService } from '../../../model/applications/draw/draw-application-service';
import { PrizeRepository } from '../../../model/infrastructures/prize-repository';
import { MemberRepository } from '../../../model/infrastructures/member-repository';
import type { PrizeDto } from '../../../model/applications/prize/dto/prize-dto';
import type { MemberDto } from '../../../model/applications/member/dto/member-dto';
import type { DrawResultDto } from '../../../model/applications/draw/dto/draw-result-dto';
import { container } from 'tsyringe';
import { usePrizeDrawOrchestrator } from './use-prize-draw-orchestrator';
import { useAudio } from '@shared-composables/use-audio';
import { AssetDataService } from '../../../model/applications/asset/asset-data-service';
import { ScreenSettingsService } from '../../../model/applications/screen-config/screen-settings-service';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation, DrawResultDialog },
    setup(_, { emit }) {
        const prizes = ref<PrizeDto[]>([]);
        const members = ref<MemberDto[]>([]);
        const latestResult = ref<DrawResultDto | null>(null);
        const currentPhase = ref<'member' | 'prize' | 'idle'>('idle');
        const showEndModal = ref(false);
        const showPrizeWinnerModal = ref(false);
        const showHalfModal = ref(false);

        // サービス
        const prizeRepo = container.resolve(PrizeRepository);
        const memberRepo = container.resolve(MemberRepository);
        const drawService = container.resolve(DrawApplicationService);

        // アニメーション関連
        const memberAnimRef = ref<MemberAnimRef | null>(null);
        const rouletteRef = ref<RouletteRef | null>(null);
        const selectedPrize = ref<PrizeDto | null>(null);
        const showPrizeResult = ref(false);

        // キーボードイベント
        const currentEnterAction = ref<(() => void) | null>(null);

        // Composable
        const { prizeStart } = usePrizeDrawOrchestrator(prizes, latestResult, rouletteRef, selectedPrize, showPrizeResult, showPrizeWinnerModal);
        const assetService = container.resolve(AssetDataService);
        const screenSettingsService = container.resolve(ScreenSettingsService);
        const { playRandomMemberBgm, stop: stopBgm } = useAudio({
            bgmMode: "random-member",
            assetService,
            screenSettingsService,
        });

        // キーボードイベントハンドラー
        const keydownDelegator = (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter') return;
            currentEnterAction.value?.();
        };

        // ライフサイクルフック
        onMounted(async () => {
            const [prizesData, membersData] = await Promise.all([prizeRepo.getPrizes(), memberRepo.getMembers()]);
            prizes.value = prizesData;
            members.value = membersData;
            currentPhase.value = 'member';

            window.addEventListener('keydown', keydownDelegator);
            currentEnterAction.value = () => { void memberStart(); };
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', keydownDelegator);
        });

        // メンバー抽選開始
        const memberStart = async () => {
            currentPhase.value = 'member';
            const res = await drawService.executeMemberDraw({ requestCount: 10 });
            if (res) {
                latestResult.value = {
                    drawId: res.drawId,
                    member: members.value.find((m: MemberDto) => m.id === res.winnerId) || { id: '', name: '', photoAssetId: undefined, rank: 0 },
                    prize: null,
                    prizeRank: null,
                    memberRank: null,
                    order: 1,
                    isWinner: true,
                    isKakuhen: false,
                };
                // start animation with winner
                if (memberAnimRef.value?.startDraw) memberAnimRef.value.startDraw(res.winnerId);
                playRandomMemberBgm();
                currentEnterAction.value = memberStop;
            }
        };

        // メンバー停止（アニメーション制御）
        const memberStop = async () => {
            stopBgm();
            if (memberAnimRef.value?.stopDraw) await memberAnimRef.value.stopDraw();
            currentEnterAction.value = null; // wait for modal close
        };

        // 景品停止
        const prizeStop = async () => {
            showPrizeResult.value = true;
        };

        // 共通のリセット処理
        const resetToMemberPhase = () => {
            currentPhase.value = 'member';
            currentEnterAction.value = () => { void memberStart(); };
            showPrizeResult.value = false;
            selectedPrize.value = null;
        };

        // ルーレット停止時
        const onRouletteStopped = (prizeId: string | null) => {
            if (prizeId && latestResult.value) {
                latestResult.value.prize = prizes.value.find((p: PrizeDto) => p.id === prizeId) || null;
                showPrizeWinnerModal.value = true;
            }
        };

        // モーダルクローズ
        const closeModal = async () => {
            if (showEndModal.value) {
                emit('end-draw');
                showEndModal.value = false;
            } else if (showHalfModal.value) {
                showHalfModal.value = false;
                resetToMemberPhase();
            } else if (showPrizeWinnerModal.value) {
                const count = await drawService.getLastPrizeCount();
                if (count.remaining <= 0) {
                    showEndModal.value = true;
                } else if (count.remaining <= count.total / 2 && !showHalfModal.value) {
                    showHalfModal.value = true;
                } else {
                    showPrizeWinnerModal.value = false;
                    resetToMemberPhase();
                }
            } else {
                // member winner modal closed
                emit('member-winner', { result: latestResult.value });
                currentPhase.value = 'prize';
                currentEnterAction.value = () => { void prizeStart(); };
            }
        };

        return {
            prizes,
            members,
            latestResult,
            currentPhase,
            showEndModal,
            showPrizeWinnerModal,
            showHalfModal,
            memberAnimRef,
            rouletteRef,
            selectedPrize,
            showPrizeResult,
            memberStart,
            memberStop,
            prizeStart,
            prizeStop,
            closeModal,
            onRouletteStopped,
        };
    }
};
</script>

<style scoped>
.orchestrator {
    max-width: 1024px;
}

.btn-primary {
    background: linear-gradient(90deg, #6d28d9, #ec4899);
    color: white;
    padding: 8px 14px;
    border-radius: 6px;
}

/* Layout tweaks for draw screen */
.rich-layout .member-area-fullscreen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: #0b0b0b;
    z-index: 50;
}

.member-stage-fullscreen {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}

.center-area {
    align-items: start;
}

.roulette-panel {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 480px;
}

.result-panel,
.guide-panel {
    min-height: 220px;
}

/* Modal styles already semi-handled by utility classes, add center stacking */
.fixed.inset-0.z-50 {
    display: flex;
    align-items: center;
    justify-content: center;
}
</style>
