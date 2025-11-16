import type { Component, Ref, Raw } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import createInputController from "./input-controller";
import { ActionQueue } from "./action-queue";

type InputController = ReturnType<typeof createInputController>;

export class BaseHandler {
  static async delayInputResume(inputController: InputController) {
    console.log("[DrawOrchestrator] delayInputResume");
    inputController.suspend();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    inputController.resume();
  }

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

  static async closeMemberWinnerDialog(showMemberWinnerDialog: Ref<boolean>) {
    console.log("[DrawOrchestrator] closeMemberWinnerDialog");
    showMemberWinnerDialog.value = false;
  }

  static async startPrizeDraw(
    preDrawResult: Ref<DrawResultDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    prizes: Ref<PrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    selectedPrize: Ref<PrizeDto | null>,
    animationRef: Ref<any>
  ) {
    console.log("[DrawOrchestrator] startPrizeDraw");
    const winnerPrizeId = preDrawResult.value!.wonPrize!.id;
    updateSelectedPrize(
      prizes.value.find((p: PrizeDto) => p.id === winnerPrizeId)!
    );
    const bgmBlob = await loadBgmBlob(selectedPrize.value!.bgm1AssetId || null);
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgmBlob);
    }
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

  static async showPrizeWinningDialogAction(
    showPrizeWinningDialog: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] showPrizeWinningDialogAction");
    showPrizeWinningDialog.value = true;
  }

  static async closePrizeWinningDialogAction(
    showPrizeWinningDialog: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] closePrizeWinningDialogAction");
    showPrizeWinningDialog.value = false;
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

  static async executeDraw(
    drawService: DrawApplicationService,
    preDrawResult: Ref<DrawResultDto | null>,
    latestResult: Ref<DrawResultDto | null>
  ) {
    console.log("[DrawOrchestrator] executeDraw");
    const res = await drawService.executeDraw({
      memberRequestCount: 10,
      prizeRequestCount: 8,
    });
    console.log("[DrawOrchestrator] executeDraw result", { res });
    preDrawResult.value = res;
    latestResult.value = res;
  }

  static async executePreDraw(
    drawService: DrawApplicationService,
    preDrawResult: Ref<DrawResultDto | null>,
    latestResult: Ref<DrawResultDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    prizes: Ref<PrizeDto[]>,
    selectedPrize: Ref<PrizeDto | null>,
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any
  ) {
    console.log("[DrawOrchestrator] executePreDraw");
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

  static async closeHalfRemainingDialogAction(
    showHalfRemainingDialog: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] closeHalfRemainingDialogAction");
    showHalfRemainingDialog.value = false;
  }

  static async showEndDialogAction(
    showEndDialog: Ref<boolean>,
    drawService: DrawApplicationService,
    queue: ActionQueue
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
        queue.clear();
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

  static async closeEndDialogAction(showEndDialog: Ref<boolean>) {
    console.log("[DrawOrchestrator] closeEndDialogAction");
    showEndDialog.value = false;
  }

  static async enqueueNextCycle(
    preDrawResult: Ref<DrawResultDto | null>,
    queue: ActionQueue,
    commonHandler: any,
    kakuhenHandler: any
  ) {
    console.log("[DrawOrchestrator] enqueueNextCycle");
    const result = preDrawResult.value!;
    const isKakuhen = result.isKakuhen || false;
    if (isKakuhen) {
      queue.addCycle(kakuhenHandler.getActions(queue));
    } else {
      queue.addCycle(commonHandler.getActions(queue));
    }
  }

  static async closeModal(showPrizeWinningDialog: Ref<boolean>) {
    console.log("[DrawOrchestrator] closeModal");
    showPrizeWinningDialog.value = false;
  }

  static async prepareNextDraw(
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
    resetToMemberPhase: () => void
  ) {
    console.log("[DrawOrchestrator] prepareNextDraw start");
    try {
      const result = preDrawResult.value!;
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
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    showMemberWinnerDialog: Ref<boolean>,
    queue: ActionQueue,
    commonHandler: any,
    kakuhenHandler: any,
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any
  ): (() => Promise<void>)[] {
    const baseActions = [
      () =>
        BaseHandler.executePreDraw(
          drawService,
          preDrawResult,
          latestResult,
          updateSelectedPrize,
          prizes,
          selectedPrize,
          currentPrizeComponent,
          markRaw,
          SlotAnimation,
          RouletteAnimation
        ),
      () => BaseHandler.startMemberDraw(preDrawResult, memberAnimRef),
      () => BaseHandler.stopMemberDraw(memberAnimRef),
      () => BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog),
      () =>
        BaseHandler.startPrizeDraw(
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
      () => BaseHandler.showEndDialogAction(showEndDialog, drawService, queue),
      () =>
        BaseHandler.enqueueNextCycle(
          preDrawResult,
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
}
