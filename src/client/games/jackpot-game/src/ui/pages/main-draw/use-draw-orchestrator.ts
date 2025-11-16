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

  const loadBgmBlob = async (assetId: string | null): Promise<Blob | null> => {
    if (!assetId) return null;
    try {
      const asset = await assetService.getAssetDataById(assetId);
      return asset?.blob || null;
    } catch (e) {
      console.log("[DrawOrchestrator] loadBgmBlob failed", e);
      return null;
    }
  };

  const resetToMemberPhase = () => {
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
        kakuhenHandler,
        currentPrizeComponent,
        markRaw,
        SlotAnimation,
        RouletteAnimation
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
        queue,
        selectedPrize,
        currentPrizeComponent,
        markRaw,
        SlotAnimation,
        RouletteAnimation
      ),
  };

  let actionRunning = false;
  const executeCurrentAction = async () => {
    if (!drawState.currentQueue || drawState.currentQueue.isEmpty()) {
      return;
    }
    if (actionRunning) {
      return;
    }

    actionRunning = true;
    try {
      const action = drawState.currentQueue.dequeue();
      if (action) {
        await action();
        // キューが空なら次のサイクルを追加
        if (drawState.currentQueue.isEmpty()) {
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
    const loadedPrizes = await prizeRepo.getPrizes();
    await updatePrizes(loadedPrizes);
    members.value = await memberRepo.getMembers();

    await drawService.initializeStateIfNeeded(prizes.value);

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
      void executeCurrentAction();
    });
    inputController.attach();
  });

  onUnmounted(() => {
    inputController.detach();
  });

  const showMemberDraw = () => {
    drawState.phase = "member";
  };

  const handleMemberDrawStart = () => {
    void showMemberDraw();
  };

  const onMemberRouletteStopped = () => {
    // Implementation if needed
  };

  const showPrizeDraw = () => {
    drawState.phase = "prize";
  };

  const onMemberWinnerDialogClosed = () => {
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
