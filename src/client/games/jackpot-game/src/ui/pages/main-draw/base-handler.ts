import type { Component, Ref, Raw } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import createInputController from "./input-controller";
import { ActionQueue } from "./action-queue";

type InputController = ReturnType<typeof createInputController>;

// Base handler for common draw actions
export class BaseHandler {
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

  static async closeModal(showPrizeWinningDialog: Ref<boolean>) {
    console.log("[DrawOrchestrator] closeModal");
    showPrizeWinningDialog.value = false;
  }

  static async prepareNextDraw(
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
    console.log("[DrawOrchestrator] prepareNextDraw start");
    const count = await drawService.getLastPrizeCount();
    console.log("[DrawOrchestrator] prepareNextDraw prize count", { count });
    if (count.remaining <= 0) {
      console.log(
        "[DrawOrchestrator] prepareNextDraw detected end condition, queuing showEndDialogAction"
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
        "[DrawOrchestrator] prepareNextDraw half remaining condition met, queuing showHalfRemainingDialogAction"
      );
      queue.enqueue(() =>
        BaseHandler.showHalfRemainingDialogAction(
          showPrizeWinningDialog,
          drawService,
          showHalfRemainingDialog
        )
      );
    } else {
      console.log("[DrawOrchestrator] prepareNextDraw starting next pre-draw");
      try {
        const res = await drawService.executeDraw({
          memberRequestCount: 10,
          prizeRequestCount: 8,
        });
        console.log("[DrawOrchestrator] prepareNextDraw pre-draw result", {
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
      () => BaseHandler.closeModal(showPrizeWinningDialog),
      () =>
        BaseHandler.prepareNextDraw(
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
