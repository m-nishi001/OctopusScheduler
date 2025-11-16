import type { Component, Ref, Raw } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import createInputController from "./input-controller";
import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";

type InputController = ReturnType<typeof createInputController>;

// Handler for kakuhen (special reroll) draw cycle
export class KakuhenHandler {
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
