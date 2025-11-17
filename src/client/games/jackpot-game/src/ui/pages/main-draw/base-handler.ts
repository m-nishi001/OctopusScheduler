import type { Ref } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import { ActionQueue } from "./action-queue";
import { type Emitter } from "mitt";

export class BaseHandler {
  static async startMemberDraw(
    preDrawResult: Ref<DrawResultDto | null>,
    memberAnimRef: Ref<any>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] startMemberDraw", {
      preDrawWinner: preDrawResult.value?.wonMember?.id,
    });
    if (memberAnimRef.value) {
      memberAnimRef.value.startDraw(preDrawResult.value?.wonMember?.id || null);
      console.log("[DrawOrchestrator] memberAnimRef.startDraw called");
    }
    emitter.emit("nextAction");
  }

  static async stopMemberDraw(memberAnimRef: Ref<any>, emitter: Emitter<any>) {
    console.log("[DrawOrchestrator] stopMemberDraw");
    if (memberAnimRef.value) {
      await memberAnimRef.value.stopDraw();
      emitter.emit("nextAction");
      console.log("[DrawOrchestrator] memberAnimRef.stopDraw completed");
    }
  }

  static async showMemberWinnerDialog(
    showMemberWinnerDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] showMemberWinnerDialog");
    showMemberWinnerDialog.value = true;
    emitter.emit("nextAction");
  }

  static async closeMemberWinnerDialog(
    showMemberWinnerDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closeMemberWinnerDialog");
    showMemberWinnerDialog.value = false;
    emitter.emit("nextAction");
  }

  static async startPrizeDraw(
    preDrawResult: Ref<DrawResultDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    prizes: Ref<PrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    selectedPrize: Ref<PrizeDto | null>,
    animationRef: Ref<any>,
    emitter: Emitter<any>
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
    emitter.emit("nextAction");
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
    showPrizeWinningDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] showPrizeWinningDialogAction");
    showPrizeWinningDialog.value = true;
    emitter.emit("nextAction");
  }

  static async closePrizeWinningDialogAction(
    showPrizeWinningDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closePrizeWinningDialogAction");
    showPrizeWinningDialog.value = false;
    emitter.emit("nextAction");
  }

  static async showHalfRemainingDialogAction(
    drawService: DrawApplicationService,
    showHalfRemainingDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] showHalfRemainingDialogAction");
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
    emitter.emit("nextAction");
  }

  static async closeEndDialogAction(
    showEndDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closeEndDialogAction");
    showEndDialog.value = false;
    emitter.emit("nextAction");
  }

  static async setMemberPhase(drawState: any, emitter: Emitter<any>) {
    console.log("[DrawOrchestrator] setMemberPhase");
    drawState.phase = "member";
    emitter.emit("nextAction");
  }

  static async setPrizePhase(drawState: any, emitter: Emitter<any>) {
    console.log("[DrawOrchestrator] setPrizePhase");
    drawState.phase = "prize";
    emitter.emit("nextAction");
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
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });
  }

  static getActions(
    preDrawResult: Ref<DrawResultDto | null>,
    selectedPrize: Ref<PrizeDto | null>,
    memberAnimRef: Ref<any>,
    animationRef: Ref<any>,
    prizes: Ref<PrizeDto[]>,
    showPrizeWinningDialog: Ref<boolean>,
    drawService: DrawApplicationService,
    showHalfRemainingDialog: Ref<boolean>,
    showEndDialog: Ref<boolean>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    showMemberWinnerDialog: Ref<boolean>,
    queue: ActionQueue,
    emitter: Emitter<any>,
    drawState: any
  ): (() => Promise<void>)[] {
    const baseActions: (() => Promise<void>)[] = [];
    baseActions.push(() => BaseHandler.setMemberPhase(drawState, emitter));
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      BaseHandler.startMemberDraw(preDrawResult, memberAnimRef, emitter)
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() => BaseHandler.stopMemberDraw(memberAnimRef, emitter));
    baseActions.push(() =>
      BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog, emitter)
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      BaseHandler.closeMemberWinnerDialog(showMemberWinnerDialog, emitter)
    );
    baseActions.push(() => BaseHandler.setPrizePhase(drawState, emitter));
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      BaseHandler.startPrizeDraw(
        preDrawResult,
        updateSelectedPrize,
        prizes,
        loadBgmBlob,
        selectedPrize,
        animationRef,
        emitter
      )
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      BaseHandler.stopPrizeDraw(selectedPrize, animationRef, emitter)
    );
    baseActions.push(() =>
      BaseHandler.showPrizeWinningDialogAction(showPrizeWinningDialog, emitter)
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      BaseHandler.closePrizeWinningDialog(showPrizeWinningDialog, emitter)
    );
    baseActions.push(() =>
      BaseHandler.showHalfRemainingDialogAction(
        drawService,
        showHalfRemainingDialog,
        emitter
      )
    );
    baseActions.push(() =>
      BaseHandler.closeHalfRemainingDialogAction(
        showHalfRemainingDialog,
        emitter
      )
    );
    baseActions.push(() =>
      BaseHandler.showEndDialogAction(
        showEndDialog,
        drawService,
        queue,
        emitter
      )
    );
    baseActions.push(() =>
      BaseHandler.closeEndDialogAction(showEndDialog, emitter)
    );

    return baseActions;
  }
}
