import {
  ref,
  onMounted,
  onUnmounted,
  reactive,
  shallowRef,
  markRaw,
} from "vue";
import type { Component, Ref, Raw } from "vue";
import { useRouter } from "vue-router";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import { PrizeRepository } from "@model/infrastructures/prize-repository";
import { MemberRepository } from "@model/infrastructures/member-repository";
import type { MemberDto } from "@model/applications/member/dto/member-dto";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { usePrizeDrawState } from "./prize-animation-state";
import createInputController from "./input-controller";
import SlotAnimation from "./slot/slot-animation.vue";
import RouletteAnimation from "./roulette/roulette-animation.vue";

import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";

type InputController = ReturnType<typeof createInputController>;

// ActionQueue class for managing action queues
export class ActionQueue {
  public actions: (() => Promise<void>)[] = [];

  enqueue(action: () => Promise<void>) {
    this.actions.push(action);
  }

  dequeue(): (() => Promise<void>) | undefined {
    return this.actions.shift();
  }

  isEmpty(): boolean {
    return this.actions.length === 0;
  }

  addCycle(actions: (() => Promise<void>)[]) {
    this.actions.push(...actions);
  }
}

// Base handler for common draw actions
class BaseHandler {
  static async startMemberDraw(
    preDrawResult: Ref<DrawResultDto | null>,
    memberAnimRef: Ref<any>
  ) {
    console.log("[DrawOrchestrator] startMemberDraw", {
      preDrawWinner: preDrawResult.value?.wonMember?.id,
    });
    if (memberAnimRef.value) {
      memberAnimRef.value.startDraw(preDrawResult.value?.wonMember?.id || null);
      console.log("[DrawOrchestrator] memberAnimRef.startDraw called");
    }
  }

  static async stopMemberDraw(memberAnimRef: Ref<any>) {
    console.log("[DrawOrchestrator] stopMemberDraw");
    if (memberAnimRef.value) {
      await memberAnimRef.value.stopDraw();
      console.log("[DrawOrchestrator] memberAnimRef.stopDraw completed");
    }
  }

  static async showMemberWinnerDialog(showMemberWinnerDialog: Ref<boolean>) {
    console.log("[DrawOrchestrator] showMemberWinnerDialog");
    showMemberWinnerDialog.value = true;
  }

  static async delayInputResume(inputController: InputController) {
    console.log("[DrawOrchestrator] delayInputResume");
    inputController.suspend();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    inputController.resume();
  }

  static async stopPrizeDraw(
    selectedPrize: Ref<PrizeDto | null>,
    animationRef: Ref<any>
  ) {
    console.log("[DrawOrchestrator] stopPrizeDraw", {
      selectedPrizeId: selectedPrize.value?.id,
    });
    if (animationRef.value?.stopSpin && selectedPrize.value) {
      await animationRef.value.stopSpin(3, selectedPrize.value.id);
      console.log("[DrawOrchestrator] stopPrizeDraw completed stopSpin");
    }
  }

  static async updateWonPrize(
    latestResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    prizeId: string
  ) {
    console.log("[DrawOrchestrator] updateWonPrize", { prizeId });
    if (latestResult.value) {
      latestResult.value.wonPrize = prizes.value.find(
        (p: PrizeDto) => p.id === prizeId
      )!;
      console.log("[DrawOrchestrator] updateWonPrize updated latestResult", {
        latestResult: latestResult.value,
      });
    }
  }

  static async showPrizeWinningDialogAction(
    showPrizeWinningDialog: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] showPrizeWinningDialogAction");
    showPrizeWinningDialog.value = true;
  }

  static async showHalfRemainingDialogAction(
    showPrizeWinningDialog: Ref<boolean>,
    drawService: DrawApplicationService,
    showHalfRemainingDialog: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] showHalfRemainingDialogAction");
    const HALF_REMAINING_SHOW_DELAY_MS = 3000;
    await new Promise((resolve) =>
      setTimeout(resolve, HALF_REMAINING_SHOW_DELAY_MS)
    );
    if (!showPrizeWinningDialog.value) return;
    try {
      const count = await drawService.getLastPrizeCount();
      if (
        count.total > 0 &&
        count.remaining > 0 &&
        count.remaining * 2 === count.total
      ) {
        console.log(
          "[DrawOrchestrator] half-remaining condition met after delay"
        );
        showHalfRemainingDialog.value = true;
      } else {
        console.log(
          "[DrawOrchestrator] half-remaining condition not met after delay",
          { count }
        );
      }
    } catch (e) {
      console.error(
        "[DrawOrchestrator] failed to check prize count for half-remaining",
        e
      );
    }
  }

  static async showEndDialogAction(
    showEndDialog: Ref<boolean>,
    drawService: DrawApplicationService
  ) {
    console.log("[DrawOrchestrator] showEndDialogAction checking prize count");
    try {
      const count = await drawService.getLastPrizeCount();
      console.log("[DrawOrchestrator] showEndDialogAction prize count", {
        count,
      });
      if (count.remaining <= 0) {
        showEndDialog.value = true;
        console.log(
          "[DrawOrchestrator] showEndDialogAction showing end dialog"
        );
      } else {
        console.log(
          "[DrawOrchestrator] showEndDialogAction not showing, remaining > 0",
          { remaining: count.remaining }
        );
      }
    } catch (e) {
      console.error(
        "[DrawOrchestrator] showEndDialogAction failed to check prize count",
        e
      );
    }
  }

  static async handleModalClose(
    drawService: DrawApplicationService,
    showEndDialog: Ref<boolean>,
    showPrizeWinningDialog: Ref<boolean>,
    showHalfRemainingDialog: Ref<boolean>,
    preDrawResult: Ref<DrawResultDto | null>,
    latestResult: Ref<DrawResultDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    prizes: Ref<PrizeDto[]>,
    selectedPrize: Ref<PrizeDto | null>,
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any,
    currentMemberComponent: Ref<string>,
    resetToMemberPhase: () => void,
    queue: ActionQueue,
    commonHandler: any,
    kakuhenHandler: any
  ) {
    console.log("[DrawOrchestrator] handleModalClose start");
    const count = await drawService.getLastPrizeCount();
    console.log("[DrawOrchestrator] handleModalClose prize count", { count });
    showPrizeWinningDialog.value = false;
    if (count.remaining <= 0) {
      console.log(
        "[DrawOrchestrator] handleModalClose detected end condition, queuing showEndDialogAction"
      );
      queue.enqueue(() =>
        BaseHandler.showEndDialogAction(showEndDialog, drawService)
      );
    } else if (
      count.total > 0 &&
      count.remaining > 0 &&
      count.remaining * 2 === count.total
    ) {
      console.log(
        "[DrawOrchestrator] handleModalClose half remaining condition met, queuing showHalfRemainingDialogAction"
      );
      queue.enqueue(() =>
        BaseHandler.showHalfRemainingDialogAction(
          showPrizeWinningDialog,
          drawService,
          showHalfRemainingDialog
        )
      );
    } else {
      console.log("[DrawOrchestrator] handleModalClose starting next pre-draw");
      try {
        const res = await drawService.executeDraw({
          memberRequestCount: 10,
          prizeRequestCount: 8,
        });
        console.log("[DrawOrchestrator] handleModalClose pre-draw result", {
          res,
        });
        preDrawResult.value = res;
        latestResult.value = res;
        const result = res;
        updateSelectedPrize(
          prizes.value.find((p: PrizeDto) => p.id === result.wonPrize!.id)!
        );
        if (selectedPrize.value?.animation === "slot") {
          currentPrizeComponent.value = markRaw(SlotAnimation as any);
        } else {
          currentPrizeComponent.value = markRaw(RouletteAnimation as any);
        }
        currentMemberComponent.value = "MemberDrawAnimation";
        resetToMemberPhase();
        // Add next cycle
        const isKakuhen = res.isKakuhen || false;
        if (isKakuhen) {
          queue.addCycle(kakuhenHandler.getActions(queue));
        } else {
          queue.addCycle(commonHandler.getActions(queue));
        }
      } catch (e: any) {
        console.error("Pre-draw failed in next cycle:", e);
        preDrawResult.value = null;
        latestResult.value = null;
        try {
          window.alert(e?.message || String(e));
        } catch (_) {
          /* noop */
        }
      }
    }
  }

  static getActions(
    preDrawResult: Ref<DrawResultDto | null>,
    selectedPrize: Ref<PrizeDto | null>,
    memberAnimRef: Ref<any>,
    animationRef: Ref<any>,
    inputController: InputController,
    latestResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    showPrizeWinningDialog: Ref<boolean>,
    drawService: DrawApplicationService,
    showHalfRemainingDialog: Ref<boolean>,
    showEndDialog: Ref<boolean>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any,
    currentMemberComponent: Ref<string>,
    resetToMemberPhase: () => void,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    showMemberWinnerDialog: Ref<boolean>,
    queue: ActionQueue,
    commonHandler: any,
    kakuhenHandler: any
  ): (() => Promise<void>)[] {
    const baseActions = [
      () => BaseHandler.startMemberDraw(preDrawResult, memberAnimRef),
      () => BaseHandler.stopMemberDraw(memberAnimRef),
      () => BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog),
      () =>
        BaseHandler.startNormalPrizeSpin(
          preDrawResult,
          updateSelectedPrize,
          prizes,
          loadBgmBlob,
          selectedPrize,
          animationRef
        ),
      () => BaseHandler.stopPrizeDraw(selectedPrize, animationRef),
      () =>
        BaseHandler.updateWonPrize(
          latestResult,
          prizes,
          selectedPrize.value!.id
        ),
      () => BaseHandler.showPrizeWinningDialogAction(showPrizeWinningDialog),
      () =>
        BaseHandler.showHalfRemainingDialogAction(
          showPrizeWinningDialog,
          drawService,
          showHalfRemainingDialog
        ),
      () =>
        BaseHandler.handleModalClose(
          drawService,
          showEndDialog,
          showPrizeWinningDialog,
          showHalfRemainingDialog,
          preDrawResult,
          latestResult,
          updateSelectedPrize,
          prizes,
          selectedPrize,
          currentPrizeComponent,
          markRaw,
          SlotAnimation,
          RouletteAnimation,
          currentMemberComponent,
          resetToMemberPhase,
          queue,
          commonHandler,
          kakuhenHandler
        ),
    ];

    return baseActions.flatMap((action, index) => {
      if (index === baseActions.length - 1) return [action]; // 最後のアクションは delay なし
      return [action, () => BaseHandler.delayInputResume(inputController)];
    });
  }

  static async startNormalPrizeSpin(
    preDrawResult: Ref<DrawResultDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    prizes: Ref<PrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    selectedPrize: Ref<PrizeDto | null>,
    animationRef: Ref<any>
  ) {
    console.log("[DrawOrchestrator] startNormalPrizeSpin");
    const winnerPrizeId = preDrawResult.value!.wonPrize!.id;
    updateSelectedPrize(
      prizes.value.find((p: PrizeDto) => p.id === winnerPrizeId)!
    );
    const bgmBlob = await loadBgmBlob(selectedPrize.value!.bgm1AssetId || null);
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgmBlob);
    }
  }
}

// Handler for kakuhen (special reroll) draw cycle
class KakuhenHandler {
  static getActions(
    preDrawResult: Ref<DrawResultDto | null>,
    selectedPrize: Ref<PrizeDto | null>,
    memberAnimRef: Ref<any>,
    animationRef: Ref<any>,
    inputController: InputController,
    latestResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    showPrizeWinningDialog: Ref<boolean>,
    drawService: DrawApplicationService,
    showHalfRemainingDialog: Ref<boolean>,
    showEndDialog: Ref<boolean>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any,
    currentMemberComponent: Ref<string>,
    resetToMemberPhase: () => void,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenOverlayVisible: Ref<boolean>,
    showMemberWinnerDialog: Ref<boolean>,
    queue: ActionQueue,
    commonHandler: any,
    kakuhenHandler: any
  ): (() => Promise<void>)[] {
    const baseActions = [
      () => BaseHandler.startMemberDraw(preDrawResult, memberAnimRef),
      () => BaseHandler.stopMemberDraw(memberAnimRef),
      () => BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog),
      () =>
        KakuhenHandler.startKakuhenDummySpin(
          preDrawResult,
          prizes,
          loadBgmBlob,
          animationRef,
          kakuhenInProgress,
          kakuhenDummyPrize,
          kakuhenFinalPrize
        ),
      () =>
        KakuhenHandler.stopKakuhenDummySpin(
          animationRef,
          kakuhenDummyPrize,
          showPrizeWinningDialog,
          kakuhenOverlayVisible
        ),
      () =>
        KakuhenHandler.startKakuhenFinalSpin(
          kakuhenFinalPrize,
          loadBgmBlob,
          animationRef
        ),
      () =>
        KakuhenHandler.stopKakuhenFinalSpin(
          animationRef,
          kakuhenFinalPrize,
          updateSelectedPrize,
          kakuhenInProgress
        ),
      () =>
        BaseHandler.updateWonPrize(
          latestResult,
          prizes,
          kakuhenFinalPrize.value!.id
        ),
      () => BaseHandler.showPrizeWinningDialogAction(showPrizeWinningDialog),
      () =>
        BaseHandler.showHalfRemainingDialogAction(
          showPrizeWinningDialog,
          drawService,
          showHalfRemainingDialog
        ),
      () =>
        BaseHandler.handleModalClose(
          drawService,
          showEndDialog,
          showPrizeWinningDialog,
          showHalfRemainingDialog,
          preDrawResult,
          latestResult,
          updateSelectedPrize,
          prizes,
          selectedPrize,
          currentPrizeComponent,
          markRaw,
          SlotAnimation,
          RouletteAnimation,
          currentMemberComponent,
          resetToMemberPhase,
          queue,
          commonHandler,
          kakuhenHandler
        ),
    ];

    return baseActions.flatMap((action, index) => {
      if (index === baseActions.length - 1) return [action]; // 最後のアクションは delay なし
      return [action, () => BaseHandler.delayInputResume(inputController)];
    });
  }

  static async startKakuhenDummySpin(
    preDrawResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    kakuhenFinalPrize: Ref<PrizeDto | null>
  ) {
    console.log("[DrawOrchestrator] startKakuhenDummySpin");
    const res = preDrawResult.value!;
    const finalPrizeId = res.wonPrize!.id;
    kakuhenFinalPrize.value = prizes.value.find(
      (p: PrizeDto) => p.id === finalPrizeId
    )!;
    const dummyCandidates = prizes.value.filter(
      (p: PrizeDto) => p.id !== finalPrizeId
    );
    kakuhenDummyPrize.value = dummyCandidates.length
      ? dummyCandidates[Math.floor(Math.random() * dummyCandidates.length)]
      : null;
    const bgm1Blob = await loadBgmBlob(
      kakuhenDummyPrize.value?.bgm1AssetId || null
    );
    kakuhenInProgress.value = true;
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgm1Blob);
    }
  }

  static async stopKakuhenDummySpin(
    animationRef: Ref<any>,
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    showPrizeWinningDialog: Ref<boolean>,
    kakuhenOverlayVisible: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenDummySpin");
    const dummyDurationMs = 2000;
    if (animationRef.value?.stopSpin) {
      await animationRef.value.stopSpin(
        dummyDurationMs / 1000,
        kakuhenDummyPrize.value?.id || null
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
    kakuhenOverlayVisible.value = true;
    await new Promise((r) => setTimeout(r, 2000));
    showPrizeWinningDialog.value = false;
    kakuhenOverlayVisible.value = false;
    await new Promise((r) => setTimeout(r, 1000));
  }

  static async startKakuhenFinalSpin(
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenFinalSpin");
    const bgm2Blob = await loadBgmBlob(
      kakuhenFinalPrize.value?.bgm2AssetId || null
    );
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgm2Blob);
    }
  }

  static async stopKakuhenFinalSpin(
    animationRef: Ref<any>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    kakuhenInProgress: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenFinalSpin");
    const finalDurationMs = 5000;
    if (animationRef.value?.stopSpin) {
      await animationRef.value.stopSpin(
        finalDurationMs / 1000,
        kakuhenFinalPrize.value!.id
      );
    }
    updateSelectedPrize(kakuhenFinalPrize.value!);
    await new Promise((r) => setTimeout(r, 1000));
    kakuhenInProgress.value = false;
  }
}

// This composable extracts the heavy orchestration logic from the Vue SFC
// so the component can stay thin and focused on template/registration.
export function useDrawOrchestrator() {
  const router = useRouter();
  const members = ref<MemberDto[]>([]);
  const latestResult = ref<DrawResultDto | null>(null);
  const drawState = reactive({
    phase: "idle" as string,
    prizeAnimationStopped: false,
    currentAction: null as (() => void) | null,
    currentQueue: null as ActionQueue | null,
  });

  // services
  const prizeRepo = container.resolve(PrizeRepository);
  const memberRepo = container.resolve(MemberRepository);
  const drawService = container.resolve(DrawApplicationService);
  const assetService = container.resolve(AssetDataService);

  // prize draw state
  const { prizes, selectedPrize, updatePrizes, updateSelectedPrize } =
    usePrizeDrawState([], null, false, assetService);

  // animation refs
  const memberAnimRef = ref(null as any);
  const animationRef = ref(null as any);

  const showPrizeWinningDialog = ref(false);
  const showHalfRemainingDialog = ref(false);
  const showEndDialog = ref(false);
  const showMemberWinnerDialog = ref(false);

  const kakuhenInProgress = ref(false);
  const kakuhenOverlayVisible = ref(false);
  const preDrawResult = ref<DrawResultDto | null>(null);

  const currentMemberComponent = ref("MemberDrawAnimation");
  const currentPrizeComponent = shallowRef<Component>(
    markRaw(RouletteAnimation)
  );

  // Define action cycles
  const kakuhenDummyPrize = ref<PrizeDto | null>(null);
  const kakuhenFinalPrize = ref<PrizeDto | null>(null);

  const inputController: InputController = createInputController({
    minIntervalMs: 1000,
  });

  // timestamped console for debug (kept local to composable)
  const enableTimestampedLogs = () => {
    const _origLog = console.log.bind(console);
    const _origWarn = console.warn.bind(console);
    const _origError = console.error.bind(console);
    console.log = (...args: unknown[]) =>
      _origLog(new Date().toISOString(), ...args);
    console.warn = (...args: unknown[]) =>
      _origWarn(new Date().toISOString(), ...args);
    console.error = (...args: unknown[]) =>
      _origError(new Date().toISOString(), ...args);
  };
  enableTimestampedLogs();

  const loadBgmBlob = async (assetId: string | null): Promise<Blob | null> => {
    console.log("[DrawOrchestrator] loadBgmBlob called", { assetId });
    if (!assetId) return null;
    try {
      const asset = await assetService.getAssetDataById(assetId);
      console.log("[DrawOrchestrator] loadBgmBlob loaded asset", {
        assetId,
        hasBlob: !!asset?.blob,
      });
      return asset?.blob || null;
    } catch (e) {
      console.log("[DrawOrchestrator] loadBgmBlob failed", e);
      return null;
    }
  };

  const resetToMemberPhase = () => {
    console.log("[DrawOrchestrator] resetToMemberPhase");
    drawState.phase = "member";
    showPrizeWinningDialog.value = false;
  };

  const commonHandler = {
    getActions: (queue: ActionQueue) =>
      BaseHandler.getActions(
        preDrawResult,
        selectedPrize,
        memberAnimRef,
        animationRef,
        inputController,
        latestResult,
        prizes,
        showPrizeWinningDialog,
        drawService,
        showHalfRemainingDialog,
        showEndDialog,
        updateSelectedPrize,
        currentPrizeComponent,
        markRaw,
        SlotAnimation,
        RouletteAnimation,
        currentMemberComponent,
        resetToMemberPhase,
        loadBgmBlob,
        showMemberWinnerDialog,
        queue,
        commonHandler,
        kakuhenHandler
      ),
  };

  const kakuhenHandler = {
    getActions: (queue: ActionQueue) =>
      KakuhenHandler.getActions(
        preDrawResult,
        selectedPrize,
        memberAnimRef,
        animationRef,
        inputController,
        latestResult,
        prizes,
        showPrizeWinningDialog,
        drawService,
        showHalfRemainingDialog,
        showEndDialog,
        updateSelectedPrize,
        currentPrizeComponent,
        markRaw,
        SlotAnimation,
        RouletteAnimation,
        currentMemberComponent,
        resetToMemberPhase,
        loadBgmBlob,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        kakuhenInProgress,
        kakuhenOverlayVisible,
        showMemberWinnerDialog,
        queue,
        commonHandler,
        kakuhenHandler
      ),
  };

  // kakuhen (special reroll) flow

  let actionRunning = false;
  const executeCurrentAction = async () => {
    if (!drawState.currentQueue || drawState.currentQueue.isEmpty()) {
      console.log(
        "[DrawOrchestrator] executeCurrentAction no actions in queue"
      );
      return;
    }
    if (actionRunning) {
      console.log(
        "[DrawOrchestrator] executeCurrentAction already running, skipping"
      );
      return;
    }

    actionRunning = true;
    try {
      const action = drawState.currentQueue.dequeue();
      if (action) {
        console.log("[DrawOrchestrator] executeCurrentAction executing action");
        await action();
        console.log("[DrawOrchestrator] executeCurrentAction action finished");
        // キューが空なら次のサイクルを追加
        if (drawState.currentQueue.isEmpty()) {
          console.log(
            "[DrawOrchestrator] executeCurrentAction queue empty, adding next cycle"
          );
          const isKakuhen = preDrawResult.value?.isKakuhen || false;
          if (isKakuhen) {
            drawState.currentQueue.addCycle(
              kakuhenHandler.getActions(drawState.currentQueue)
            );
          } else {
            drawState.currentQueue.addCycle(
              commonHandler.getActions(drawState.currentQueue)
            );
          }
        }
        // 次のアクションを実行
        void executeCurrentAction();
      }
    } catch (e) {
      console.error("Error executing action from queue", e);
    } finally {
      actionRunning = false;
    }
  };

  onMounted(async () => {
    console.log("[DrawOrchestrator] onMounted start");
    const loadedPrizes = await prizeRepo.getPrizes();
    console.log("[DrawOrchestrator] loaded prizes count", {
      count: loadedPrizes.length,
    });
    await updatePrizes(loadedPrizes);
    members.value = await memberRepo.getMembers();
    console.log("[DrawOrchestrator] loaded members count", {
      count: members.value.length,
    });

    await drawService.initializeStateIfNeeded(prizes.value);
    console.log("[DrawOrchestrator] initialized draw state if needed");

    try {
      const res = await drawService.executeDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });
      console.log("[DrawOrchestrator] pre-draw result received", { res });
      preDrawResult.value = res;
      latestResult.value = res;
      updateSelectedPrize(
        prizes.value.find((p: PrizeDto) => p.id === res.wonPrize!.id)!
      );
      if (selectedPrize.value?.animation === "slot") {
        currentPrizeComponent.value = markRaw(SlotAnimation as any);
        console.log("[DrawOrchestrator] selected component: SlotAnimation");
      } else {
        currentPrizeComponent.value = markRaw(RouletteAnimation as any);
        console.log("[DrawOrchestrator] selected component: RouletteAnimation");
      }
    } catch (e: any) {
      console.error("[DrawOrchestrator] pre-draw failed", e);
      preDrawResult.value = null;
      latestResult.value = null;
      try {
        window.alert(e?.message || String(e));
      } catch (_) {
        /* noop */
      }
    }

    currentMemberComponent.value = "MemberDrawAnimation";

    // Initialize queue
    drawState.currentQueue = new ActionQueue();
    const isKakuhen = preDrawResult.value?.isKakuhen || false;
    if (isKakuhen) {
      drawState.currentQueue.addCycle(
        kakuhenHandler.getActions(drawState.currentQueue)
      );
    } else {
      drawState.currentQueue.addCycle(
        commonHandler.getActions(drawState.currentQueue)
      );
    }

    inputController.setOnTrigger(() => {
      console.log("[DrawOrchestrator] inputController triggered Enter");
      void executeCurrentAction();
    });
    inputController.attach();
    console.log("[DrawOrchestrator] onMounted done, input controller attached");
  });

  onUnmounted(() => {
    inputController.detach();
  });

  const showMemberDraw = () => {
    console.log("[DrawOrchestrator] showMemberDraw");
    drawState.phase = "member";
  };

  const handleMemberDrawStart = () => {
    console.log("[DrawOrchestrator] handleMemberDrawStart");
    void showMemberDraw();
  };

  const onMemberRouletteStopped = () => {
    console.log("[DrawOrchestrator] onMemberRouletteStopped", {
      latestResult: latestResult.value,
    });
  };

  const showPrizeDraw = () => {
    console.log("[DrawOrchestrator] showPrizeDraw");
    drawState.phase = "prize";
  };

  const onMemberWinnerDialogClosed = () => {
    console.log("[DrawOrchestrator] onMemberWinnerDialogClosed");
    showMemberWinnerDialog.value = false;
    try {
      inputController.resume();
    } catch (e) {}
  };

  const onHalfRemainingClosed = async () => {
    console.log("[DrawOrchestrator] onHalfRemainingClosed start");
    showHalfRemainingDialog.value = false;
    try {
      const res = await drawService.executeDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });
      console.log("[DrawOrchestrator] onHalfRemainingClosed pre-draw result", {
        res,
      });
      preDrawResult.value = res;
      latestResult.value = res;
      const result = res;
      updateSelectedPrize(
        prizes.value.find((p: PrizeDto) => p.id === result.wonPrize!.id)!
      );
      if (selectedPrize.value?.animation === "slot") {
        currentPrizeComponent.value = markRaw(SlotAnimation as any);
      } else {
        currentPrizeComponent.value = markRaw(RouletteAnimation as any);
      }
      currentMemberComponent.value = "MemberDrawAnimation";
      resetToMemberPhase();
      try {
        const count = await drawService.getLastPrizeCount();
        console.log(
          "[DrawOrchestrator] onHalfRemainingClosed refreshed count",
          { count }
        );
        showEndDialog.value = count.remaining <= 0;
      } catch (e: any) {
        console.error(
          "Failed to refresh prize count after half-remaining close:",
          e
        );
        try {
          window.alert(e?.message || String(e));
        } catch (_) {
          /* noop */
        }
      }
    } catch (e: any) {
      console.error("Pre-draw failed in next cycle:", e);
      preDrawResult.value = null;
      latestResult.value = null;
      try {
        window.alert(e?.message || String(e));
      } catch (_) {
        /* noop */
      }
    }
  };

  const onEndClosed = () => {
    console.log("[DrawOrchestrator] onEndClosed");
    showEndDialog.value = false;
    showHalfRemainingDialog.value = false;
    router.push("/jackpot-ending");
  };

  // Wrapper functions for return
  const startMemberDraw = async () => {
    await BaseHandler.startMemberDraw(preDrawResult, memberAnimRef);
  };

  const memberStop = async () => {
    await BaseHandler.stopMemberDraw(memberAnimRef);
  };

  const prizeStop = async () => {
    await BaseHandler.stopPrizeDraw(selectedPrize, animationRef);
  };

  const closeModal = async () => {
    await BaseHandler.handleModalClose(
      drawService,
      showEndDialog,
      showPrizeWinningDialog,
      showHalfRemainingDialog,
      preDrawResult,
      latestResult,
      updateSelectedPrize,
      prizes,
      selectedPrize,
      currentPrizeComponent,
      markRaw,
      SlotAnimation,
      RouletteAnimation,
      currentMemberComponent,
      resetToMemberPhase,
      drawState.currentQueue!,
      commonHandler,
      kakuhenHandler
    );
  };

  const onMemberWinnerDialogShown = async () => {
    await BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog);
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
    prizeStop,
    closeModal,
    onMemberRouletteStopped,
    showPrizeWinningDialog,
    showHalfRemainingDialog,
    showEndDialog,
    showMemberWinnerDialog,
    onHalfRemainingClosed,
    onEndClosed,
    handleMemberDrawStart,
    onMemberWinnerDialogShown,
    onMemberWinnerDialogClosed,
    kakuhenInProgress,
    kakuhenOverlayVisible,
  } as const;
}
