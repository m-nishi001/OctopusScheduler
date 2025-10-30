<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">

            <DrawResultDialog v-if="drawState.resultShown" title="景品当選" :assetId="latestResult?.prize?.imageAssetId"
                primaryLabel="次へ" @close="closeModal">
                当選景品: <strong>{{ latestResult?.prize?.name }}</strong>
            </DrawResultDialog>

            <div class="rich-layout">
                <section class="member-area-fullscreen" v-if="drawState.phase === 'member'">
                    <div class="member-stage-fullscreen">
                        <MemberDrawAnimation ref="memberAnimRef" :members="members" :externalDialog="false"
                            @start="() => { void memberStart(); }" @member-selected="onMemberSelected" />
                    </div>
                </section>

                <section v-if="drawState.phase === 'prize'"
                    class="center-area flex items-center justify-center min-h-screen">
                    <div class="roulette-panel">
                        <RouletteAnimation ref="rouletteRef" :prizes="prizes" :selectedPrize="selectedPrize"
                            :showResult="drawState.resultShown" @stopped="onRouletteStopped" />
                    </div>
                </section>
            </div>

        </div>
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, reactive } from 'vue';
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
        const drawState = reactive({
            phase: 'idle',
            resultShown: false,
            currentAction: null as (() => void) | null,
        });

        // サービス
        const prizeRepo = container.resolve(PrizeRepository);
        const memberRepo = container.resolve(MemberRepository);
        const drawService = container.resolve(DrawApplicationService);
        const assetService = container.resolve(AssetDataService);
        const screenSettingsService = container.resolve(ScreenSettingsService);

        // アニメーション関連
        const memberAnimRef = ref<MemberAnimRef | null>(null);
        const rouletteRef = ref<RouletteRef | null>(null);
        const selectedPrize = ref<PrizeDto | null>(null);

        // Composable
        const { playRandomMemberBgm, stop: stopBgm } = useAudio({
            bgmMode: "random-member",
            assetService,
            screenSettingsService,
        });

        // BGM URL ロード
        const loadBgmUrl = async (assetId: string | null): Promise<string | null> => {
            if (!assetId) return null;
            try {
                const asset = await assetService.getAssetDataById(assetId);
                return asset?.blob ? URL.createObjectURL(asset.blob) : null;
            } catch {
                return null;
            }
        };

        // かくへん抽選処理
        const handleKakuhenDraw = async (res: any) => {
            const dummyPrize = prizes.value.find((p) => p.id === res.dummyPrizeIds[0]);
            const reservedPrize = prizes.value.find(
                (p) => p.id === res.reservedPrizeIds?.[0]
            );

            const [bgm1Url, bgm2Url] = await Promise.all([
                loadBgmUrl(dummyPrize?.bgm1AssetId || null),
                loadBgmUrl(reservedPrize?.bgm2AssetId || null),
            ]);

            if (rouletteRef.value?.runAutoReroll) {
                await rouletteRef.value.runAutoReroll({
                    dummyPrizeId: res.dummyPrizeIds[0] || null,
                    finalPrizeId: res.reservedPrizeIds?.[0] || null,
                    dummyDuration: 2000,
                    finalDuration: 2000,
                    bgm1Url,
                    bgm2Url,
                });
            }

            const assignRes = await drawService.executeKakuhenAssign();
            if (assignRes.winnerPrizeId) {
                latestResult.value!.prize =
                    prizes.value.find((p) => p.id === assignRes.winnerPrizeId) || null;
                drawState.resultShown = true;
            }
        };

        // 通常抽選処理
        const handleNormalDraw = async (res: any) => {
            selectedPrize.value =
                prizes.value.find((p) => p.id === res.winnerPrizeId) || null;
            const bgmUrl = await loadBgmUrl(selectedPrize.value?.bgm1AssetId || null);

            if (rouletteRef.value?.startSpin) {
                rouletteRef.value.startSpin(bgmUrl);
                drawState.currentAction = prizeStop;
            }
        };

        // 景品抽選開始
        const prizeStart = async () => {
            drawState.phase = 'prize';
            if (!latestResult.value || !latestResult.value.member) return;
            const res = await drawService.executePrizeDraw({
                memberId: latestResult.value.member.id,
                requestCount: 8,
            });
            if (!res) return;

            if (res.isKakuhen) {
                await handleKakuhenDraw(res);
            } else {
                await handleNormalDraw(res);
            }
        };

        // キーボードイベントハンドラー
        const keydownDelegator = (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter') return;
            drawState.currentAction?.();
        };

        // ライフサイクルフック
        onMounted(async () => {
            const [prizesData, membersData] = await Promise.all([prizeRepo.getPrizes(), memberRepo.getMembers()]);
            prizes.value = prizesData;
            members.value = membersData;

            resetToMemberPhase();

            window.addEventListener('keydown', keydownDelegator);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', keydownDelegator);
        });

        // メンバー抽選開始
        const memberStart = async () => {
            drawState.phase = 'member';
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
                drawState.currentAction = memberStop;
            }
        };

        const onMemberSelected = () => {
            emit('member-winner', { result: latestResult.value });
            drawState.currentAction = () => { void prizeStart(); };
        };

        // メンバー停止（アニメーション制御）
        const memberStop = async () => {
            stopBgm();
            if (memberAnimRef.value?.stopDraw) await memberAnimRef.value.stopDraw();
        };

        // 景品停止
        const prizeStop = async () => {
            if (rouletteRef.value?.stopSpin) await rouletteRef.value.stopSpin();
            drawState.resultShown = true;
        };

        // 共通のリセット処理
        const resetToMemberPhase = () => {
            drawState.phase = 'member';
            drawState.currentAction = () => { void memberStart(); };
            drawState.resultShown = false;
            selectedPrize.value = null;
        };

        // ルーレット停止時
        const onRouletteStopped = (prizeId: string | null) => {
            if (prizeId && latestResult.value) {
                latestResult.value.prize = prizes.value.find((p: PrizeDto) => p.id === prizeId) || null;
                drawState.resultShown = true;
            }
        };

        // モーダルクローズ
        const closeModal = async () => {
            const count = await drawService.getLastPrizeCount();
            if (count.remaining <= 0) {
                emit('end-draw');
            } else if (count.remaining <= count.total / 2) {
                resetToMemberPhase();
            } else {
                drawState.resultShown = false;
                resetToMemberPhase();
            }
        };

        return {
            prizes,
            members,
            latestResult,
            drawState,
            memberAnimRef,
            rouletteRef,
            selectedPrize,
            memberStart,
            memberStop,
            prizeStart,
            prizeStop,
            closeModal,
            onRouletteStopped,
            onMemberSelected,
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
