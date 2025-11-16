import type { Ref } from "vue";
import type { Component, Raw } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import createInputController from "./input-controller";
import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";

type InputController = ReturnType<typeof createInputController>;

export class KakuhenHandler {
  static getActions(
    preDrawResult: Ref<DrawResultDto | null>,
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
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenMessageVisible: Ref<boolean>,
    showMemberWinnerDialog: Ref<boolean>,
    queue: ActionQueue,
    selectedPrize: Ref<PrizeDto | null>,
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
      () => BaseHandler.closeMemberWinnerDialog(showMemberWinnerDialog),
      () =>
        KakuhenHandler.startKakuhenDummyDraw(
          preDrawResult,
          prizes,
          loadBgmBlob,
          animationRef,
          kakuhenInProgress,
          kakuhenDummyPrize,
          kakuhenFinalPrize
        ),
      () =>
        KakuhenHandler.stopKakuhenDummyDraw(animationRef, kakuhenDummyPrize),
      () => KakuhenHandler.showKakuhenMessage(kakuhenMessageVisible),
      () =>
        KakuhenHandler.closePrizeWinningDialogForKakuhen(
          showPrizeWinningDialog
        ),
      () => KakuhenHandler.hideKakuhenMessage(kakuhenMessageVisible),
      () =>
        KakuhenHandler.startKakuhenFinalDraw(
          kakuhenFinalPrize,
          loadBgmBlob,
          animationRef
        ),
      () =>
        KakuhenHandler.stopKakuhenFinalDraw(
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
      () => BaseHandler.closePrizeWinningDialogAction(showPrizeWinningDialog),
      () =>
        BaseHandler.showHalfRemainingDialogAction(
          showPrizeWinningDialog,
          drawService,
          showHalfRemainingDialog
        ),
      () => BaseHandler.closeHalfRemainingDialogAction(showHalfRemainingDialog),
      () => BaseHandler.showEndDialogAction(showEndDialog, drawService, queue),
      () => BaseHandler.closeEndDialogAction(showEndDialog),
    ];

    return baseActions.flatMap((action, index) => {
      if (index === baseActions.length - 1) return [action]; // 最後のアクションは delay なし
      return [action, () => BaseHandler.delayInputResume(inputController)];
    });
  }

  static async startKakuhenDummyDraw(
    preDrawResult: Ref<DrawResultDto | null>,
    prizes: Ref<PrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenDummyPrize: Ref<PrizeDto | null>,
    kakuhenFinalPrize: Ref<PrizeDto | null>
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
  }

  static async stopKakuhenDummyDraw(
    animationRef: Ref<any>,
    kakuhenDummyPrize: Ref<PrizeDto | null>
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
  }

  static async showKakuhenMessage(kakuhenMessageVisible: Ref<boolean>) {
    console.log("[DrawOrchestrator] showKakuhenMessage");
    kakuhenMessageVisible.value = true;
    await new Promise((r) => setTimeout(r, 2000));
  }

  static async hideKakuhenMessage(kakuhenMessageVisible: Ref<boolean>) {
    console.log("[DrawOrchestrator] hideKakuhenMessage");
    kakuhenMessageVisible.value = false;
    await new Promise((r) => setTimeout(r, 1000));
  }

  static async closePrizeWinningDialogForKakuhen(
    showPrizeWinningDialog: Ref<boolean>
  ) {
    console.log("[DrawOrchestrator] closePrizeWinningDialogForKakuhen");
    showPrizeWinningDialog.value = false;
  }

  static async startKakuhenFinalDraw(
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenFinalDraw");
    const bgm2Blob = await loadBgmBlob(
      kakuhenFinalPrize.value?.bgm2AssetId || null
    );
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgm2Blob);
    }
  }

  static async stopKakuhenFinalDraw(
    animationRef: Ref<any>,
    kakuhenFinalPrize: Ref<PrizeDto | null>,
    updateSelectedPrize: (prize: PrizeDto) => void,
    kakuhenInProgress: Ref<boolean>
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
    await new Promise((r) => setTimeout(r, 1000));
    kakuhenInProgress.value = false;
  }
}
