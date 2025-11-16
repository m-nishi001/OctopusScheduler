import type { Component, Ref, Raw } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import { ActionQueue } from "./action-queue";
import { type Emitter } from "mitt";

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

  static async stopMemberDraw(memberAnimRef: Ref<any>, emitter: Emitter<any>) {
    console.log("[DrawOrchestrator] stopMemberDraw");
    if (memberAnimRef.value) {
      await memberAnimRef.value.stopDraw();
      emitter.emit("nextAction");
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
    animationRef: Ref<any>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopPrizeDraw", {
      selectedPrizeId: selectedPrize.value?.id,
    });
    if (animationRef.value?.stopSpin && selectedPrize.value) {
      await animationRef.value.stopSpin(3, selectedPrize.value.id);
      emitter.emit("nextAction");
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
    latestResult: Ref<DrawResultDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    prizes: Ref<PrizeDto[]>,
    selectedPrize: Ref<PrizeDto | null>,
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any
  ) {
    console.log("[DrawOrchestrator] executeDraw");
    try {
      const res = await drawService.executeDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });
      console.log("[DrawOrchestrator] draw result received", { res });
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
      console.error("[DrawOrchestrator] draw failed", e);
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
    showHalfRemainingDialog: Ref<boolean>,
    emitter: Emitter<any>
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
      emitter.emit("nextAction");
    } catch (e) {
      console.error(
        "[DrawOrchestrator] failed to check prize count for half-remaining",
        e
      );
    }
  }

  static async closeHalfRemainingDialogAction(
    showHalfRemainingDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closeHalfRemainingDialogAction");
    showHalfRemainingDialog.value = false;
    emitter.emit("nextAction");
  }

  static async showEndDialogAction(
    showEndDialog: Ref<boolean>,
    drawService: DrawApplicationService,
    queue: ActionQueue,
    emitter: Emitter<any>
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
        emitter.emit("nextAction");
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

  static async setMemberPhase(drawState: any) {
    console.log("[DrawOrchestrator] setMemberPhase");
    drawState.phase = "member";
  }

  static async setPrizePhase(drawState: any) {
    console.log("[DrawOrchestrator] setPrizePhase");
    drawState.phase = "prize";
  }

  static async closePrizeWinningDialog(
    showPrizeWinningDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closePrizeWinningDialog");
    showPrizeWinningDialog.value = false;
    emitter.emit("nextAction");
  }

  static async wait(seconds: number = 1): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }

  static getActions(
    preDrawResult: Ref<DrawResultDto | null>,
    selectedPrize: Ref<PrizeDto | null>,
    memberAnimRef: Ref<any>,
    animationRef: Ref<any>,
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
    currentPrizeComponent: Ref<Component>,
    markRaw: <T extends object>(value: T) => Raw<T>,
    SlotAnimation: any,
    RouletteAnimation: any,
    emitter: Emitter<any>,
    drawState: any
  ): (() => Promise<void>)[] {
    const baseActions = [
      () => BaseHandler.setMemberPhase(drawState),
      () =>
        BaseHandler.executeDraw(
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
      () => BaseHandler.wait(1),
      () => BaseHandler.stopMemberDraw(memberAnimRef, emitter),
      () => BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog),
      () => BaseHandler.wait(1),
      () => BaseHandler.setPrizePhase(drawState),
      () =>
        BaseHandler.startPrizeDraw(
          preDrawResult,
          updateSelectedPrize,
          prizes,
          loadBgmBlob,
          selectedPrize,
          animationRef
        ),
      () => BaseHandler.wait(1),
      () => BaseHandler.stopPrizeDraw(selectedPrize, animationRef, emitter),
      () =>
        BaseHandler.updateWonPrize(
          latestResult,
          prizes,
          selectedPrize.value!.id
        ),
      () => BaseHandler.showPrizeWinningDialogAction(showPrizeWinningDialog),
      () => BaseHandler.wait(1),
      () =>
        BaseHandler.closePrizeWinningDialog(showPrizeWinningDialog, emitter),
      () =>
        BaseHandler.showHalfRemainingDialogAction(
          showPrizeWinningDialog,
          drawService,
          showHalfRemainingDialog,
          emitter
        ),
      () =>
        BaseHandler.closeHalfRemainingDialogAction(
          showHalfRemainingDialog,
          emitter
        ),
      () =>
        BaseHandler.showEndDialogAction(
          showEndDialog,
          drawService,
          queue,
          emitter
        ),
      () => BaseHandler.closeEndDialogAction(showEndDialog),
    ];
    return baseActions;
  }
}
