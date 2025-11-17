import type { Ref } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";
import { type Emitter } from "mitt";

export class KakuhenHandler {
  static getActions(
    preDrawResult: Ref<DrawResultDto | null>,
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
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenMessageVisible: Ref<boolean>,
    showMemberWinnerDialog: Ref<boolean>,
    queue: ActionQueue,
    emitter: Emitter<any>,
    drawState: any
  ): (() => Promise<void>)[] {
    const baseActions: (() => Promise<void>)[] = [];
    baseActions.push(() => BaseHandler.setMemberPhase(drawState));
    baseActions.push(() =>
      BaseHandler.startMemberDraw(preDrawResult, memberAnimRef, emitter)
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() => BaseHandler.stopMemberDraw(memberAnimRef, emitter));
    baseActions.push(() =>
      BaseHandler.showMemberWinnerDialog(showMemberWinnerDialog, emitter)
    );
    baseActions.push(() =>
      BaseHandler.closeMemberWinnerDialog(showMemberWinnerDialog)
    );
    baseActions.push(() => BaseHandler.setPrizePhase(drawState, emitter));
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      KakuhenHandler.startKakuhenDummyDraw(
        preDrawResult,
        prizes,
        loadBgmBlob,
        animationRef,
        kakuhenInProgress,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        emitter
      )
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      KakuhenHandler.stopKakuhenDummyDraw(
        animationRef,
        kakuhenDummyPrize,
        emitter
      )
    );
    baseActions.push(() =>
      KakuhenHandler.showKakuhenMessage(kakuhenMessageVisible, emitter)
    );
    baseActions.push(() =>
      KakuhenHandler.hideKakuhenMessage(kakuhenMessageVisible, emitter)
    );
    baseActions.push(() =>
      KakuhenHandler.closePrizeWinningDialogForKakuhen(
        showPrizeWinningDialog,
        emitter
      )
    );
    baseActions.push(() =>
      KakuhenHandler.startKakuhenFinalDraw(
        kakuhenFinalPrize,
        loadBgmBlob,
        animationRef,
        emitter
      )
    );
    baseActions.push(() =>
      KakuhenHandler.stopKakuhenFinalDraw(
        animationRef,
        kakuhenFinalPrize,
        updateSelectedPrize,
        kakuhenInProgress,
        latestResult,
        prizes,
        emitter
      )
    );
    baseActions.push(() =>
      BaseHandler.showPrizeWinningDialogAction(showPrizeWinningDialog, emitter)
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      BaseHandler.closePrizeWinningDialogAction(showPrizeWinningDialog, emitter)
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

  static async startKakuhenDummyDraw(
    preDrawResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenDummyDraw");
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
    emitter.emit("nextAction");
  }

  static async stopKakuhenDummyDraw(
    animationRef: Ref<any>,
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenDummyDraw");
    const dummyDurationMs = 2000;
    if (animationRef.value?.stopSpin) {
      await animationRef.value.stopSpin(
        dummyDurationMs / 1000,
        kakuhenDummyPrize.value?.id || null
      );
    }
    await new Promise((r) => setTimeout(r, 3000));
    emitter.emit("nextAction");
  }

  static async showKakuhenMessage(
    kakuhenMessageVisible: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] showKakuhenMessage");
    kakuhenMessageVisible.value = true;
    await new Promise((r) => setTimeout(r, 2000));
    emitter.emit("nextAction");
  }

  static async hideKakuhenMessage(
    kakuhenMessageVisible: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] hideKakuhenMessage");
    kakuhenMessageVisible.value = false;
    emitter.emit("nextAction");
  }

  static async closePrizeWinningDialogForKakuhen(
    showPrizeWinningDialog: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closePrizeWinningDialogForKakuhen");
    showPrizeWinningDialog.value = false;
    emitter.emit("nextAction");
  }

  static async startKakuhenFinalDraw(
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenFinalDraw");
    const bgm2Blob = await loadBgmBlob(
      kakuhenFinalPrize.value?.bgm2AssetId || null
    );
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgm2Blob);
    }
    await new Promise((r) => setTimeout(r, 3000));
    emitter.emit("nextAction");
  }

  static async stopKakuhenFinalDraw(
    animationRef: Ref<any>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    kakuhenInProgress: Ref<boolean>,
    latestResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenFinalDraw");
    const finalDurationMs = 5000;
    if (animationRef.value?.stopSpin) {
      await animationRef.value.stopSpin(
        finalDurationMs / 1000,
        kakuhenFinalPrize.value!.id
      );
    }
    updateSelectedPrize(kakuhenFinalPrize.value!);
    kakuhenInProgress.value = false;
    latestResult.value!.wonPrize = prizes.value.find(
      (p: PrizeDto) => p.id === kakuhenFinalPrize.value!.id
    )!;
    emitter.emit("nextAction");
  }
}
