<template>
    <MainLayout>
        <div class="orchestrator container mx-auto p-6">

            <DrawResultDialog v-if="showPrizeWinningDialog" title="景品当選" :assetId="latestResult?.wonPrize?.imageAssetId"
                primaryLabel="次へ" @close="closeModal">
                当選景品: <strong>{{ latestResult?.wonPrize?.name }}</strong>
            </DrawResultDialog>

            <HalfRemainingDialog v-if="showHalfRemainingDialog" :visible="showHalfRemainingDialog"
                @close="onHalfRemainingClosed" />
            <EndDialog v-if="showEndDialog" :visible="showEndDialog" @close="onEndClosed" />

            <div class="rich-layout">
                <section class="member-area-fullscreen" v-if="drawState.phase === 'member'">
                    <div class="member-stage-fullscreen">
                        <MemberDrawAnimation ref="memberAnimRef" :members="members" :externalDialog="false"
                            @start="() => { void showMemberDraw(); }" @member-selected="onMemberSelected" />
                    </div>
                </section>

                <section v-if="drawState.phase === 'prize'"
                    class="center-area flex items-center justify-center min-h-screen">
                    <div class="roulette-panel">
                        <component :is="currentPrizeComponent" ref="animationRef" :prizes="prizes"
                            :selectedPrize="selectedPrize" :showResult="showPrizeWinningDialog"
                            @stopped="onRouletteStopped" />
                    </div>
                </section>
            </div>

        </div>
    </MainLayout>
</template>

<script lang="ts">
import { ref, onMounted, onUnmounted, reactive, shallowRef, markRaw, computed } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation, { type MemberAnimRef } from './member-draw-animation.vue';
import RouletteAnimation from './roulette-animation.vue';
import SlotAnimation from './slot-animation.vue';
import type { AnimationRef } from './animation-types';
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
import HalfRemainingDialog from './half-remaining-dialog.vue';
import EndDialog from './end-dialog.vue';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation, SlotAnimation, DrawResultDialog, HalfRemainingDialog, EndDialog },
    setup(_, { emit }) {
        const router = useRouter();
        const prizes = ref<PrizeDto[]>([]);
        const members = ref<MemberDto[]>([]);
        const latestResult = ref<DrawResultDto | null>(null);
        const drawState = reactive({
            phase: 'idle',
            prizeAnimationStopped: false,
            currentAction: null as (() => void) | null,
            currentPrizeCount: { total: 0, remaining: 0 },
        });

        const showPrizeWinningDialog = computed(() => {
            return drawState.prizeAnimationStopped;
        });

        const showHalfRemainingDialog = computed(() => {
            return drawState.currentPrizeCount.remaining > 0 && drawState.currentPrizeCount.remaining <= drawState.currentPrizeCount.total / 2;
        });

        const showEndDialog = computed(() => {
            return drawState.currentPrizeCount.remaining <= 0;
        });

        // 事前抽選結果
        const preDrawResults = reactive({
            memberWinnerId: null as string | null,
            prizeResult: null as any,
        });

        // コンポーネント分岐（拡張用）
        const currentMemberComponent = ref('MemberDrawAnimation');
        const currentPrizeComponent = shallowRef<Component>(markRaw(RouletteAnimation));

        // サービス
        const prizeRepo = container.resolve(PrizeRepository);
        const memberRepo = container.resolve(MemberRepository);
        const drawService = container.resolve(DrawApplicationService);
        const assetService = container.resolve(AssetDataService);
        const screenSettingsService = container.resolve(ScreenSettingsService);

        // アニメーション関連
        const memberAnimRef = ref<MemberAnimRef | null>(null);
        const animationRef = ref<AnimationRef | null>(null);
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
            const dummyPrize = prizes.value.find((p) => p.id === res.dummyWinnerPrizeId);
            const reservedPrize = prizes.value.find(
                (p) => p.id === res.winnerPrizeId
            );

            const [bgm1Url, bgm2Url] = await Promise.all([
                loadBgmUrl(dummyPrize?.bgm1AssetId || null),
                loadBgmUrl(reservedPrize?.bgm2AssetId || null),
            ]);

            if (animationRef.value?.runAutoReroll) {
                await animationRef.value.runAutoReroll({
                    dummyPrizeId: res.dummyWinnerPrizeId || null,
                    finalPrizeId: res.winnerPrizeId || null,
                    dummyDuration: 2000,
                    finalDuration: 2000,
                    bgm1Url,
                    bgm2Url,
                });
            }
        };

        // 通常抽選処理
        const handleNormalDraw = async (res: any) => {
            selectedPrize.value =
                prizes.value.find((p) => p.id === res.winnerPrizeId) || null;
            if (!selectedPrize.value) {
                throw new Error('Prize not found for winnerPrizeId: ' + res.winnerPrizeId);
            }
            const bgmUrl = await loadBgmUrl(selectedPrize.value?.bgm1AssetId || null);

            if (animationRef.value?.startSpin) {
                animationRef.value.startSpin(bgmUrl);
            }
        };

        // 新規関数: アニメーション開始
        const startRouletteAnimation = async (res: any) => {
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

        onMounted(async () => {

            // 初期データロード
            [prizes.value, members.value] = await Promise.all([prizeRepo.getPrizes(), memberRepo.getMembers()]);

            // 事前抽選実行
            const res = await drawService.executeDraw({
                memberRequestCount: 10,
                prizeRequestCount: 8,
            });

            preDrawResults.memberWinnerId = res.memberWinnerId;
            preDrawResults.prizeResult = { winnerPrizeId: res.prizeWinnerId, isKakuhen: res.isKakuhen };
            latestResult.value = res.drawResult;

            if (res.prizeWinnerId) {
                selectedPrize.value = prizes.value.find((p) => p.id === res.prizeWinnerId) || null;
                // 分岐判定（例: 特定の景品なら特殊コンポーネント/BGM）
                if (selectedPrize.value?.animation === 'slot') {
                    currentPrizeComponent.value = markRaw(SlotAnimation);
                } else {
                    currentPrizeComponent.value = markRaw(RouletteAnimation);
                }
            }
            // 分岐判定（例: 特定のメンバーなら特殊コンポーネント/BGM）
            // ここではデフォルト
            currentMemberComponent.value = 'MemberDrawAnimation';

            showMemberDraw();

            // 景品カウントの初期化
            const count = await drawService.getLastPrizeCount();
            drawState.currentPrizeCount = count;

            window.addEventListener('keydown', keydownDelegator);
        });

        onUnmounted(() => {
            window.removeEventListener('keydown', keydownDelegator);
        });

        // メンバー抽選表示
        const showMemberDraw = () => {
            drawState.phase = 'member';
            drawState.currentAction = () => { void startMemberDraw(); };
        };

        // メンバー抽選開始
        const startMemberDraw = async () => {
            // 事前結果を使ってアニメーション開始
            if (memberAnimRef.value?.startDraw) {
                memberAnimRef.value.startDraw(preDrawResults.memberWinnerId);
            }
            playRandomMemberBgm();
            drawState.currentAction = memberStop;
        };

        const onMemberSelected = () => {
            emit('member-winner', { result: latestResult.value });
            drawState.currentAction = () => { void showPrizeDraw(); };
        };

        // メンバー停止（アニメーション制御）
        const memberStop = async () => {
            stopBgm();
            if (memberAnimRef.value?.stopDraw) await memberAnimRef.value.stopDraw();
        };

        // 景品抽選表示
        const showPrizeDraw = () => {
            drawState.phase = 'prize';
            drawState.currentAction = () => { void startPrizeDraw(); };
        };

        // 景品抽選開始
        const startPrizeDraw = async () => {
            if (!preDrawResults.prizeResult) {
                throw new Error('No prize result available');
            }
            // 事前結果を使ってアニメーション開始
            await startRouletteAnimation(preDrawResults.prizeResult);
            drawState.currentAction = prizeStop;
        };

        // 景品停止
        const prizeStop = async () => {
            if (animationRef.value?.stopSpin) await animationRef.value.stopSpin();
            drawState.prizeAnimationStopped = true;
        };

        // 共通のリセット処理
        const resetToMemberPhase = () => {
            drawState.phase = 'member';
            drawState.currentAction = () => { void showMemberDraw(); };
            drawState.prizeAnimationStopped = false;
            selectedPrize.value = null;
        };

        // ルーレット停止時
        const onRouletteStopped = (prizeId: string | null) => {
            if (!prizeId) throw new Error('No prize selected');
            if (latestResult.value) {
                latestResult.value.wonPrize = prizes.value.find((p: PrizeDto) => p.id === prizeId) || null;
                drawState.prizeAnimationStopped = true;
                drawState.currentAction = () => { void closeModal(); };
            }
        };

        // モーダルクローズ
        const closeModal = async () => {
            const count = await drawService.getLastPrizeCount();
            drawState.currentPrizeCount = count;
            if (count.remaining <= 0) {
                // 終了DLGは computed で表示
            } else if (count.remaining <= count.total / 2) {
                // あと半分DLGは computed で表示
            } else {
                // 次のサイクル: 新しい事前抽選実行
                try {
                    const res = await drawService.executeDraw({
                        memberRequestCount: 10,
                        prizeRequestCount: 8,
                    });
                    preDrawResults.memberWinnerId = res.memberWinnerId;
                    preDrawResults.prizeResult = { winnerPrizeId: res.prizeWinnerId, isKakuhen: res.isKakuhen };
                    latestResult.value = res.drawResult;
                    if (res.prizeWinnerId) {
                        selectedPrize.value = prizes.value.find((p) => p.id === res.prizeWinnerId) || null;
                        if (selectedPrize.value?.animation === 'slot') {
                            currentPrizeComponent.value = markRaw(SlotAnimation);
                        } else {
                            currentPrizeComponent.value = markRaw(RouletteAnimation);
                        }
                    }
                    currentMemberComponent.value = 'MemberDrawAnimation';
                    resetToMemberPhase();
                } catch (e) {
                    console.error('Pre-draw failed in next cycle:', e);
                    // 必要に応じてエラーハンドリング
                }
            }
        };

        // ダイアログクローズハンドラー
        const onHalfRemainingClosed = async () => {
            drawState.currentPrizeCount = { total: 0, remaining: 0 };  // リセット
            // 次のサイクル処理
            try {
                const res = await drawService.executeDraw({
                    memberRequestCount: 10,
                    prizeRequestCount: 8,
                });
                preDrawResults.memberWinnerId = res.memberWinnerId;
                preDrawResults.prizeResult = { winnerPrizeId: res.prizeWinnerId, isKakuhen: res.isKakuhen };
                latestResult.value = res.drawResult;
                if (res.prizeWinnerId) {
                    selectedPrize.value = prizes.value.find((p) => p.id === res.prizeWinnerId) || null;
                    if (selectedPrize.value?.animation === 'slot') {
                        currentPrizeComponent.value = markRaw(SlotAnimation);
                    } else {
                        currentPrizeComponent.value = markRaw(RouletteAnimation);
                    }
                }
                currentMemberComponent.value = 'MemberDrawAnimation';
                resetToMemberPhase();
            } catch (e) {
                console.error('Pre-draw failed in next cycle:', e);
            }
        };

        const onEndClosed = () => {
            drawState.currentPrizeCount = { total: 0, remaining: 0 };
            router.push('/jackpot-ending');
        };

        return {
            prizes,
            members,
            latestResult,
            drawState,
            memberAnimRef,
            animationRef,
            selectedPrize,
            currentPrizeComponent,
            showMemberDraw,
            startMemberDraw,
            memberStop,
            showPrizeDraw,
            startPrizeDraw,
            prizeStop,
            closeModal,
            onRouletteStopped,
            onMemberSelected,
            showPrizeWinningDialog,
            showHalfRemainingDialog,
            showEndDialog,
            onHalfRemainingClosed,
            onEndClosed,
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
