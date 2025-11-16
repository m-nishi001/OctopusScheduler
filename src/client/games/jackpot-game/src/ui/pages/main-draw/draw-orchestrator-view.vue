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
                            @start="handleMemberDrawStart" @member-selected="onMemberRouletteStopped"
                            @winner-dialog-shown="onMemberWinnerDialogShown" @winner-dialog-closed="onMemberWinnerDialogClosed" />
                    </div>
                </section>

                <section v-if="drawState.phase === 'prize'"
                    class="center-area flex items-center justify-center min-h-screen">
                    <div class="roulette-panel">
                        <component :is="currentPrizeComponent" ref="animationRef" :prizes="prizes"
                            :selectedPrize="selectedPrize" :showResult="showPrizeWinningDialog"
                            @stopped="onPrizeRouletteStopped" />
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
import MainLayout from '../common/main-layout.vue';
import MemberDrawAnimation, { type MemberAnimRef } from './member-draw/member-draw-animation.vue';
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
import createInputController from './input-controller';

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

        // Console のロギングをタイムスタンプ付きにする（デバッグ用）
        // NOTE: store original functions to avoid recursion when overriding
        const enableTimestampedLogs = () => {
            const _origLog = console.log.bind(console);
            const _origWarn = console.warn.bind(console);
            const _origError = console.error.bind(console);

            console.log = (...args: unknown[]) => _origLog(new Date().toISOString(), ...args);
            console.warn = (...args: unknown[]) => _origWarn(new Date().toISOString(), ...args);
            console.error = (...args: unknown[]) => _origError(new Date().toISOString(), ...args);
        };
        enableTimestampedLogs();

        // BGM Blob ロード
        const loadBgmBlob = async (assetId: string | null): Promise<Blob | null> => {
            console.log('[DrawOrchestrator] loadBgmBlob called', { assetId });
            if (!assetId) return null;
            try {
                const asset = await assetService.getAssetDataById(assetId);
                console.log('[DrawOrchestrator] loadBgmBlob loaded asset', { assetId, hasBlob: !!asset?.blob });
                return asset?.blob || null;
            } catch (e) {
                console.log('[DrawOrchestrator] loadBgmBlob failed', e);
                return null;
            }
        };

        // かくへん抽選処理
        const handleKakuhenDraw = async (res: DrawResultDto) => {
            console.log('[DrawOrchestrator] handleKakuhenDraw called', { res });
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

            console.log('[DrawOrchestrator] handleKakuhenDraw bgm blobs loaded', { dummyPrizeId: dummyPrize?.id, finalPrizeId, hasBgm1: !!bgm1Blob, hasBgm2: !!bgm2Blob });

            // Use the base AnimationRef APIs (startSpin/stopSpin) to perform
            // the dummy -> final reroll sequence instead of an explicit
            // runAutoReroll method.
            const dummyDurationMs = 2000;
            const finalDurationMs = 2000;

            try {
                if (animationRef.value?.startSpin) {
                    animationRef.value.startSpin(bgm1Blob);
                    console.log('[DrawOrchestrator] handleKakuhenDraw started dummy spin', { dummyPrizeId: dummyPrize?.id });
                }

                if (animationRef.value?.stopSpin) {
                    await animationRef.value.stopSpin(
                        dummyDurationMs / 1000,
                        dummyPrize?.id || null,
                    );
                    console.log('[DrawOrchestrator] handleKakuhenDraw stopped dummy spin');
                }

                // small gap between dummy and final
                await new Promise((r) => setTimeout(r, 1000));

                if (animationRef.value?.startSpin) {
                    // start final BGM (if any)
                    animationRef.value.startSpin(bgm2Blob);
                    console.log('[DrawOrchestrator] handleKakuhenDraw started final spin', { finalPrizeId });
                }

                if (animationRef.value?.stopSpin) {
                    await animationRef.value.stopSpin(
                        finalDurationMs / 1000,
                        finalPrizeId
                    );
                    console.log('[DrawOrchestrator] handleKakuhenDraw stopped final spin', { finalPrizeId });
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
            console.log('[DrawOrchestrator] handleNormalDraw called', { res });
            const winnerPrizeId = res.wonPrize!.id;
            updateSelectedPrize(prizes.value.find((p) => p.id === winnerPrizeId)!);

            const bgmBlob = await loadBgmBlob(selectedPrize.value!.bgm1AssetId || null);
            console.log('[DrawOrchestrator] handleNormalDraw bgm blob loaded', { winnerPrizeId, hasBgm: !!bgmBlob });

            if (animationRef.value?.startSpin) {
                animationRef.value.startSpin(bgmBlob);
                console.log('[DrawOrchestrator] handleNormalDraw started spin', { winnerPrizeId });
            }
        };

        // 新規関数: アニメーション開始
        const startRouletteAnimation = async (res: any) => {
            console.log('[DrawOrchestrator] startRouletteAnimation', { res });
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
            console.log('[DrawOrchestrator] executeCurrentAction called', { hasAction: !!action, actionRunning });
            if (!action) {
                console.log('[DrawOrchestrator] executeCurrentAction no action to run');
                return;
            }
            if (actionRunning) {
                console.log('[DrawOrchestrator] executeCurrentAction already running, skipping');
                return; // 既に実行中なら無視
            }

            // 実行開始時点で currentAction を無効化して二重実行を防ぐ
            drawState.currentAction = null;
            actionRunning = true;
            try {
                // 呼び出し結果が Promise でも非同期に対応するため Promise.resolve で待つ
                console.log('[DrawOrchestrator] executeCurrentAction starting action');
                await Promise.resolve(action());
                console.log('[DrawOrchestrator] executeCurrentAction action finished');
            } catch (e) {
                console.error('Error executing currentAction', e);
            } finally {
                actionRunning = false;
                console.log('[DrawOrchestrator] executeCurrentAction cleaned up');
            }
        };

        // Input controller will attach to window and call executeCurrentAction
        const inputController = createInputController({ minIntervalMs: 1000 });

        onMounted(async () => {
            console.log('[DrawOrchestrator] onMounted start');

            // 初期データロード
            const loadedPrizes = await prizeRepo.getPrizes();
            console.log('[DrawOrchestrator] loaded prizes count', { count: loadedPrizes.length });
            await updatePrizes(loadedPrizes);
            members.value = await memberRepo.getMembers();
            console.log('[DrawOrchestrator] loaded members count', { count: members.value.length });

            // 景品抽選状態の初期化
            await drawService.initializeStateIfNeeded(prizes.value);
            console.log('[DrawOrchestrator] initialized draw state if needed');

            // 事前抽選実行（例外発生時は UI でアラート表示）
            try {
                const res = await drawService.executeDraw({
                    memberRequestCount: 10,
                    prizeRequestCount: 8,
                });
                console.log('[DrawOrchestrator] pre-draw result received', { res });
                preDrawResult.value = res;
                latestResult.value = res;

                // 成功時は必ず DrawResultDto が返る想定
                updateSelectedPrize(prizes.value.find((p) => p.id === res.wonPrize!.id)!);
                // 分岐判定（例: 特定の景品なら特殊コンポーネント/BGM）
                if (selectedPrize.value?.animation === 'slot') {
                    currentPrizeComponent.value = markRaw(SlotAnimation);
                    console.log('[DrawOrchestrator] selected component: SlotAnimation');
                } else {
                    currentPrizeComponent.value = markRaw(RouletteAnimation);
                    console.log('[DrawOrchestrator] selected component: RouletteAnimation');
                }
            } catch (e: any) {
                console.error('[DrawOrchestrator] pre-draw failed', e);
                preDrawResult.value = null;
                latestResult.value = null;
                // ユーザーへの通知（要求どおりアラート）
                try { window.alert(e?.message || String(e)); } catch (_) { /* noop */ }
            }
            // 分岐判定（例: 特定のメンバーなら特殊コンポーネント/BGM）
            // ここではデフォルト
            currentMemberComponent.value = 'MemberDrawAnimation';

            showMemberDraw();

            // wire input controller to orchestrator
            inputController.setOnTrigger(() => {
                console.log('[DrawOrchestrator] inputController triggered Enter');
                void executeCurrentAction();
            });
            inputController.attach();
            console.log('[DrawOrchestrator] onMounted done, input controller attached');
        });

        const _dialogTimers: number[] = [];

        onUnmounted(() => {
            inputController.detach();
            for (const t of _dialogTimers) try { clearTimeout(t); } catch (e) { }
        });

        // メンバー抽選表示
        const showMemberDraw = () => {
            console.log('[DrawOrchestrator] showMemberDraw');
            drawState.phase = 'member';
            drawState.currentAction = () => { void startMemberDraw(); };
        };

        const handleMemberDrawStart = () => {
            console.log('[DrawOrchestrator] handleMemberDrawStart');
            void showMemberDraw();
        };

        // メンバー抽選開始
        const startMemberDraw = async () => {
            console.log('[DrawOrchestrator] startMemberDraw', { preDrawWinner: preDrawResult.value?.wonMember?.id });
            if (memberAnimRef.value) {
                memberAnimRef.value.startDraw(preDrawResult.value?.wonMember?.id || null);
                console.log('[DrawOrchestrator] memberAnimRef.startDraw called');
            }
            drawState.currentAction = memberStop;
        };

        const onMemberRouletteStopped = () => {
            console.log('[DrawOrchestrator] onMemberRouletteStopped', { latestResult: latestResult.value });
            // We defer enabling the next action until the member-winner
            // dialog is visible and at least 1s has passed to satisfy the
            // UI timing requirement. The member animation component will
            // emit 'winner-dialog-shown' which we handle elsewhere.
            emit('member-winner', { result: latestResult.value });
            drawState.currentAction = null;
        };

        // メンバー停止（アニメーション制御）
        const memberStop = async () => {
            console.log('[DrawOrchestrator] memberStop');
            if (memberAnimRef.value) {
                await memberAnimRef.value.stopDraw();
                console.log('[DrawOrchestrator] memberAnimRef.stopDraw completed');
            }
        };

        // 景品抽選表示
        const showPrizeDraw = () => {
            console.log('[DrawOrchestrator] showPrizeDraw');
            drawState.phase = 'prize';
            drawState.currentAction = () => { void startPrizeDraw(); };
        };

        // 景品抽選開始
        const startPrizeDraw = async () => {
            console.log('[DrawOrchestrator] startPrizeDraw', { preDrawResult: preDrawResult.value });
            if (!preDrawResult.value) {
                // 景品なしの場合、次のサイクルへ
                console.log('[DrawOrchestrator] startPrizeDraw no preDrawResult, resetting to member phase');
                resetToMemberPhase();
                return;
            }
            // 事前結果(確定済み)を使ってアニメーション開始
            await startRouletteAnimation(preDrawResult.value);
            console.log('[DrawOrchestrator] startPrizeDraw animation started');
            drawState.currentAction = prizeStop;
        };

        // 景品停止
        const prizeStop = async () => {
            console.log('[DrawOrchestrator] prizeStop', { selectedPrizeId: selectedPrize.value?.id });
            if (animationRef.value?.stopSpin && selectedPrize.value) {
                await animationRef.value.stopSpin(3, selectedPrize.value.id);
                console.log('[DrawOrchestrator] prizeStop completed stopSpin');
            }
        };

        // 共通のリセット処理
        const resetToMemberPhase = () => {
            console.log('[DrawOrchestrator] resetToMemberPhase');
            drawState.phase = 'member';
            drawState.currentAction = () => { void showMemberDraw(); };
            showPrizeWinningDialog.value = false;
        };

        // 明示的にあと半分ダイアログを開くための関数
        const openHalfRemainingDialog = () => {
            console.log('[DrawOrchestrator] openHalfRemainingDialog');
            showHalfRemainingDialog.value = true;
        };

        // ルーレット停止時
        const onPrizeRouletteStopped = (prizeId: string | null) => {
            console.log('[DrawOrchestrator] onRouletteStopped', { prizeId });
            if (!prizeId) throw new Error('No prize selected');
            if (latestResult.value) {
                latestResult.value.wonPrize = prizes.value.find((p) => p.id === prizeId)!;
                showPrizeWinningDialog.value = true;
                // Do NOT enable the close action immediately: suspend input
                // and enable the action after at least 1s so dialogs are
                // guaranteed to be visible for minimum duration and a held
                // Enter doesn't skip the dialog.
                drawState.currentAction = null;
                inputController.suspend();
                const tid = window.setTimeout(() => {
                    drawState.currentAction = () => { void closeModal(); };
                    inputController.resume();
                    console.log('[DrawOrchestrator] prize dialog close action enabled after delay');
                }, 1000);
                _dialogTimers.push(tid as unknown as number);
                console.log('[DrawOrchestrator] onRouletteStopped updated latestResult', { latestResult: latestResult.value });
            }
        };

        const onMemberWinnerDialogShown = () => {
            console.log('[DrawOrchestrator] onMemberWinnerDialogShown');
            // prevent Enter processing while dialog is shown for at least 1s
            inputController.suspend();
            drawState.currentAction = null;
            const tid = window.setTimeout(() => {
                drawState.currentAction = () => showPrizeDraw();
                inputController.resume();
                console.log('[DrawOrchestrator] member winner action enabled after delay');
            }, 1000);
            _dialogTimers.push(tid as unknown as number);
        };

        const onMemberWinnerDialogClosed = () => {
            console.log('[DrawOrchestrator] onMemberWinnerDialogClosed');
            // when internal dialog closes nothing else required; ensure input
            // controller is resumed in case closure happened before our timer
            try { inputController.resume(); } catch (e) { }
        };

        // モーダルクローズ
        const closeModal = async () => {
            console.log('[DrawOrchestrator] closeModal start');
            // Note: no pending timer to clear (we use a single delayed setTimeout and dialog buttons are inert)
            const count = await drawService.getLastPrizeCount();
            console.log('[DrawOrchestrator] closeModal prize count', { count });
            showEndDialog.value = count.remaining <= 0;
            showPrizeWinningDialog.value = false;
            drawState.currentAction = null;
            if (count.remaining <= 0) {
                // 終了DLGは showEndDialog フラグで表示
                console.log('[DrawOrchestrator] closeModal detected end condition, showEndDialog set');
            } else if (count.total > 0 && count.remaining > 0 && count.remaining * 2 === count.total) {
                // 残りがちょうど半分のときはダイアログを直接開く
                console.log('[DrawOrchestrator] closeModal half remaining condition met');
                openHalfRemainingDialog();
            } else {
                // 次のサイクル: 新しい事前抽選実行
                console.log('[DrawOrchestrator] closeModal starting next pre-draw');
                try {
                    const res = await drawService.executeDraw({
                        memberRequestCount: 10,
                        prizeRequestCount: 8,
                    });
                    console.log('[DrawOrchestrator] closeModal pre-draw result', { res });
                    preDrawResult.value = res;
                    latestResult.value = res;
                    const result = res;
                    updateSelectedPrize(prizes.value.find((p) => p.id === result.wonPrize!.id)!);
                    if (selectedPrize.value?.animation === 'slot') {
                        currentPrizeComponent.value = markRaw(SlotAnimation);
                    } else {
                        currentPrizeComponent.value = markRaw(RouletteAnimation);
                    }
                    currentMemberComponent.value = 'MemberDrawAnimation';
                    resetToMemberPhase();
                } catch (e: any) {
                    console.error('Pre-draw failed in next cycle:', e);
                    preDrawResult.value = null;
                    latestResult.value = null;
                    try { window.alert(e?.message || String(e)); } catch (_) { /* noop */ }
                }
            }
        };

        // ダイアログクローズハンドラー
        const onHalfRemainingClosed = async () => {
            console.log('[DrawOrchestrator] onHalfRemainingClosed start');
            showHalfRemainingDialog.value = false;
            try {
                const res = await drawService.executeDraw({
                    memberRequestCount: 10,
                    prizeRequestCount: 8,
                });
                console.log('[DrawOrchestrator] onHalfRemainingClosed pre-draw result', { res });
                preDrawResult.value = res;
                latestResult.value = res;
                const result = res;
                updateSelectedPrize(prizes.value.find((p) => p.id === result.wonPrize!.id)!);
                if (selectedPrize.value?.animation === 'slot') {
                    currentPrizeComponent.value = markRaw(SlotAnimation);
                } else {
                    currentPrizeComponent.value = markRaw(RouletteAnimation);
                }
                currentMemberComponent.value = 'MemberDrawAnimation';
                resetToMemberPhase();
                // 更新された景品カウントを取得して反映する（これにより showHalfRemainingDialog が解除される）
                try {
                    const count = await drawService.getLastPrizeCount();
                    console.log('[DrawOrchestrator] onHalfRemainingClosed refreshed count', { count });
                    // ダイアログ閉了後はカウントを取得し、終了ダイアログ表示フラグを更新する
                    showEndDialog.value = count.remaining <= 0;
                } catch (e: any) {
                    console.error('Failed to refresh prize count after half-remaining close:', e);
                    try { window.alert(e?.message || String(e)); } catch (_) { /* noop */ }
                }
            } catch (e: any) {
                console.error('Pre-draw failed in next cycle:', e);
                preDrawResult.value = null;
                latestResult.value = null;
                try { window.alert(e?.message || String(e)); } catch (_) { /* noop */ }
            }
        };

        const onEndClosed = () => {
            console.log('[DrawOrchestrator] onEndClosed');
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
            onPrizeRouletteStopped,
            onMemberRouletteStopped,
            showPrizeWinningDialog,
            showHalfRemainingDialog,
            showEndDialog,
            onHalfRemainingClosed,
            onEndClosed,
            handleMemberDrawStart,
            onMemberWinnerDialogShown,
            onMemberWinnerDialogClosed,
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
