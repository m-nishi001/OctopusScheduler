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
                            @start="handleMemberDrawStart" @member-selected="onMemberSelected" />
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
import { ref, onMounted, onUnmounted, reactive, shallowRef, markRaw } from 'vue';
import type { Component } from 'vue';
import { useRouter } from 'vue-router';
import MainLayout from '../../common/main-layout.vue';
import MemberDrawAnimation, { type MemberAnimRef } from '../member-draw/member-draw-animation.vue';
import RouletteAnimation from './roulette/roulette-animation.vue';
import SlotAnimation from './slot-animation.vue';
import type { AnimationRef } from './animation-types';
import DrawResultDialog from './prize-winning-dialog.vue';
import { DrawApplicationService } from '@model/applications/draw/draw-application-service';
import { PrizeRepository } from '@model/infrastructures/prize-repository';
import { MemberRepository } from '@model/infrastructures/member-repository';
import type { MemberDto } from '@model/applications/member/dto/member-dto';
import type { DrawResultDto } from '@model/applications/draw/dto/draw-result-dto';
import { container } from 'tsyringe';
import { AssetDataService } from '@model/applications/asset/asset-data-service';
import { usePrizeDrawState } from './prize-animation-state';

import HalfRemainingDialog from './half-remaining-dialog.vue';
import EndDialog from './end-dialog.vue';

export default {
    name: 'DrawOrchestratorPage',
    components: { MainLayout, MemberDrawAnimation, RouletteAnimation, SlotAnimation, DrawResultDialog, HalfRemainingDialog, EndDialog },
    setup(_, { emit }) {
        const router = useRouter();
        const members = ref<MemberDto[]>([]);
        const latestResult = ref<DrawResultDto | null>(null);
        const drawState = reactive({
            phase: 'idle',
            prizeAnimationStopped: false,
            currentAction: null as (() => void) | null,
        });

        // サービス
        const prizeRepo = container.resolve(PrizeRepository);
        const memberRepo = container.resolve(MemberRepository);
        const drawService = container.resolve(DrawApplicationService);
        const assetService = container.resolve(AssetDataService);

        // 景品抽選状態管理
        const {
            prizes,
            selectedPrize,
            updatePrizes,
            updateSelectedPrize,
        } = usePrizeDrawState([], null, false, assetService);

        // アニメーション関連
        const memberAnimRef = ref<MemberAnimRef | null>(null);
        const animationRef = ref<AnimationRef | null>(null);

        const showPrizeWinningDialog = ref(false);
        const showHalfRemainingDialog = ref(false);
        const showEndDialog = ref(false);

        // 事前抽選結果 (確定済みの DrawResultDto または null)
        const preDrawResult = ref<DrawResultDto | null>(null);

        // コンポーネント分岐（拡張用）
        const currentMemberComponent = ref('MemberDrawAnimation');
        const currentPrizeComponent = shallowRef<Component>(markRaw(RouletteAnimation));

        // BGM Blob ロード
        const loadBgmBlob = async (assetId: string | null): Promise<Blob | null> => {
            if (!assetId) return null;
            try {
                const asset = await assetService.getAssetDataById(assetId);
                return asset?.blob || null;
            } catch {
                return null;
            }
        };

        // かくへん抽選処理
        const handleKakuhenDraw = async (res: DrawResultDto) => {
            // DrawResultDto contains the finalized wonPrize. For animation we
            // choose a dummy prize (different from final) to show first and use
            // the finalized prize as the final reveal.
            const finalPrizeId = res.wonPrize!.id;
            const finalPrize = prizes.value.find((p) => p.id === finalPrizeId)!;

            // pick a dummy prize different from finalPrize
            const dummyCandidates = prizes.value.filter((p) => p.id !== finalPrizeId);
            const dummyPrize = dummyCandidates.length
                ? dummyCandidates[Math.floor(Math.random() * dummyCandidates.length)]
                : null;

            const [bgm1Blob, bgm2Blob] = await Promise.all([
                loadBgmBlob(dummyPrize?.bgm1AssetId || null),
                loadBgmBlob(finalPrize.bgm2AssetId || null),
            ]);

            // Use the base AnimationRef APIs (startSpin/stopSpin) to perform
            // the dummy -> final reroll sequence instead of an explicit
            // runAutoReroll method.
            const dummyDurationMs = 2000;
            const finalDurationMs = 2000;

            try {
                if (animationRef.value?.startSpin) {
                    animationRef.value.startSpin(bgm1Blob);
                }

                if (animationRef.value?.stopSpin) {
                    await animationRef.value.stopSpin(
                        dummyDurationMs / 1000,
                        dummyPrize?.id || null,
                    );
                }

                // small gap between dummy and final
                await new Promise((r) => setTimeout(r, 1000));

                if (animationRef.value?.startSpin) {
                    // start final BGM (if any)
                    animationRef.value.startSpin(bgm2Blob);
                }

                if (animationRef.value?.stopSpin) {
                    await animationRef.value.stopSpin(
                        finalDurationMs / 1000,
                        finalPrizeId
                    );
                }
            } catch (e) {
                // If the animation component does not fully support the
                // sequence we attempt, fall back to no-op (caller will still
                // handle finalization via events).
                console.warn('Kakuhen reroll sequence failed:', e);
            }

            // Update selectedPrize for the final prize
            updateSelectedPrize(finalPrize);
        };

        // 通常抽選処理
        const handleNormalDraw = async (res: DrawResultDto) => {
            const winnerPrizeId = res.wonPrize!.id;
            updateSelectedPrize(prizes.value.find((p) => p.id === winnerPrizeId)!);

            const bgmBlob = await loadBgmBlob(selectedPrize.value!.bgm1AssetId || null);

            if (animationRef.value?.startSpin) {
                animationRef.value.startSpin(bgmBlob);
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

        // 再入禁止フラグ: アニメーションなどの長い処理が完了するまで同じ action を再実行しない
        let actionRunning = false;
        const executeCurrentAction = async () => {
            const action = drawState.currentAction;
            if (!action) return;
            if (actionRunning) return; // 既に実行中なら無視

            // 実行開始時点で currentAction を無効化して二重実行を防ぐ
            drawState.currentAction = null;
            actionRunning = true;
            try {
                // 呼び出し結果が Promise でも非同期に対応するため Promise.resolve で待つ
                await Promise.resolve(action());
            } catch (e) {
                console.error('Error executing currentAction', e);
            } finally {
                actionRunning = false;
            }
        };

        const keydownDelegator = (ev: KeyboardEvent) => {
            if (ev.key !== 'Enter') return;
            void executeCurrentAction();
        };

        onMounted(async () => {

            // 初期データロード
            const loadedPrizes = await prizeRepo.getPrizes();
            await updatePrizes(loadedPrizes);
            members.value = await memberRepo.getMembers();

            // 景品抽選状態の初期化
            await drawService.initializeStateIfNeeded(prizes.value);

            // 事前抽選実行（サーバーは確定済みの DrawResultDto を返す）
            const res = await drawService.executeDraw({
                memberRequestCount: 10,
                prizeRequestCount: 8,
            });

            preDrawResult.value = res;
            latestResult.value = res;

            if (res !== null) {
                updateSelectedPrize(prizes.value.find((p) => p.id === res.wonPrize!.id)!);
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

        const handleMemberDrawStart = () => {
            void showMemberDraw();
        };

        // メンバー抽選開始
        const startMemberDraw = async () => {
            if (memberAnimRef.value) {
                memberAnimRef.value.startDraw(preDrawResult.value?.wonMember?.id || null);
            }
            drawState.currentAction = memberStop;
        };

        const onMemberSelected = () => {
            emit('member-winner', { result: latestResult.value });
            drawState.currentAction = () => { void showPrizeDraw(); };
        };

        // メンバー停止（アニメーション制御）
        const memberStop = async () => {
            if (memberAnimRef.value) await memberAnimRef.value.stopDraw();
        };

        // 景品抽選表示
        const showPrizeDraw = () => {
            drawState.phase = 'prize';
            drawState.currentAction = () => { void startPrizeDraw(); };
        };

        // 景品抽選開始
        const startPrizeDraw = async () => {
            if (!preDrawResult.value) {
                // 景品なしの場合、次のサイクルへ
                resetToMemberPhase();
                return;
            }
            // 事前結果(確定済み)を使ってアニメーション開始
            await startRouletteAnimation(preDrawResult.value);
            drawState.currentAction = prizeStop;
        };

        // 景品停止
        const prizeStop = async () => {
            if (animationRef.value?.stopSpin && selectedPrize.value) await animationRef.value.stopSpin(3, selectedPrize.value.id);
        };

        // 共通のリセット処理
        const resetToMemberPhase = () => {
            drawState.phase = 'member';
            drawState.currentAction = () => { void showMemberDraw(); };
            showPrizeWinningDialog.value = false;
        };

        // 明示的にあと半分ダイアログを開くための関数
        const openHalfRemainingDialog = () => {
            showHalfRemainingDialog.value = true;
        };

        // ルーレット停止時
        const onRouletteStopped = (prizeId: string | null) => {
            if (!prizeId) throw new Error('No prize selected');
            if (latestResult.value) {
                latestResult.value.wonPrize = prizes.value.find((p) => p.id === prizeId)!;
                // 表示はローカルで制御
                showPrizeWinningDialog.value = true;
                drawState.currentAction = () => { void closeModal(); };
            }
        };

        // モーダルクローズ
        const closeModal = async () => {
            const count = await drawService.getLastPrizeCount();
            showEndDialog.value = count.remaining <= 0;
            showPrizeWinningDialog.value = false;
            drawState.currentAction = null;
            if (count.remaining <= 0) {
                // 終了DLGは showEndDialog フラグで表示
            } else if (count.total > 0 && count.remaining > 0 && count.remaining * 2 === count.total) {
                // 残りがちょうど半分のときはダイアログを直接開く
                openHalfRemainingDialog();
            } else {
                // 次のサイクル: 新しい事前抽選実行
                try {
                    const res = await drawService.executeDraw({
                        memberRequestCount: 10,
                        prizeRequestCount: 8,
                    });
                    preDrawResult.value = res;
                    latestResult.value = res;
                    if (res !== null) {
                        const result = res;
                        updateSelectedPrize(prizes.value.find((p) => p.id === result.wonPrize!.id)!);
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
            // ユーザーが閉じたら即座に非表示にする。
            showHalfRemainingDialog.value = false;
            try {
                const res = await drawService.executeDraw({
                    memberRequestCount: 10,
                    prizeRequestCount: 8,
                });
                preDrawResult.value = res;
                latestResult.value = res;
                if (res !== null) {
                    const result = res;
                    updateSelectedPrize(prizes.value.find((p) => p.id === result.wonPrize!.id)!);
                    if (selectedPrize.value?.animation === 'slot') {
                        currentPrizeComponent.value = markRaw(SlotAnimation);
                    } else {
                        currentPrizeComponent.value = markRaw(RouletteAnimation);
                    }
                }
                currentMemberComponent.value = 'MemberDrawAnimation';
                resetToMemberPhase();
                // 更新された景品カウントを取得して反映する（これにより showHalfRemainingDialog が解除される）
                try {
                    const count = await drawService.getLastPrizeCount();
                    // ダイアログ閉了後はカウントを取得し、終了ダイアログ表示フラグを更新する
                    showEndDialog.value = count.remaining <= 0;
                } catch (e) {
                    console.error('Failed to refresh prize count after half-remaining close:', e);
                }
            } catch (e) {
                console.error('Pre-draw failed in next cycle:', e);
            }
        };

        const onEndClosed = () => {
            // 終了時はカウントをクリアし、ダイアログを閉じる
            // no persistent count to clear; just hide dialogs
            showEndDialog.value = false;
            showHalfRemainingDialog.value = false;
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
            handleMemberDrawStart,
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
