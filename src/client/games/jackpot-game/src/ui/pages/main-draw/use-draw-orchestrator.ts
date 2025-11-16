import {
  ref,
  onMounted,
  onUnmounted,
  reactive,
  shallowRef,
  markRaw,
} from "vue";
import type { Component } from "vue";
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

import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";
import { KakuhenHandler } from "./kakuhen-handler";

type InputController = ReturnType<typeof createInputController>;

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
        loadBgmBlob,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        kakuhenInProgress,
        kakuhenOverlayVisible,
        showMemberWinnerDialog,
        queue
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

  const closeMemberWinnerDialog = () => {
    console.log("[DrawOrchestrator] closeMemberWinnerDialog");
    showMemberWinnerDialog.value = false;
    try {
      inputController.resume();
    } catch (e) {}
  };

  const closePrizeWinningDialog = () => {
    drawState.currentQueue!.enqueue(() =>
      BaseHandler.closeModal(showPrizeWinningDialog)
    );
    drawState.currentQueue!.enqueue(() =>
      BaseHandler.prepareNextDraw(
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
        resetToMemberPhase
      )
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
    closePrizeWinningDialog,
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
    closeMemberWinnerDialog,
    kakuhenInProgress,
    kakuhenOverlayVisible,
  } as const;
}
