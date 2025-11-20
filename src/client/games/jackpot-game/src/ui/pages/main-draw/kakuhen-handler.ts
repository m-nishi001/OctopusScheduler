import type { Ref } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";
import { type Emitter } from "mitt";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import type { RoulettePrizeDto } from "./roulette/roulette-prize-preparer";

/**
 * KakuhenHandler orchestrates the two-step "確変" animation sequence.
 *
 * New behavior (2025-11-18):
 * - The UI shows two roulette sectors for the same prize (same id), but
 *   with different images: the first sector uses the prize's imageAssetId (画像1),
 *   the second sector uses the prize's image2AssetId (画像2).
 * - The two spins both target the same prize id, but the first targets occurrence=1
 *   (the first duplicated sector) and the second targets occurrence=2.
 * - No random dummy prize is selected; the dummy display is actually the same prize
 *   presented with image1 to give a different visual impression.
 */
export class KakuhenHandler {
  private static _prevPrize: PrizeDto | null = null;
  private static _prevPrizes: RoulettePrizeDto[] | null = null;
  private static _kakuhenPrepared: any[] | null = null;
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
    drawState: any,
    preparePrizes: (newPrizes: RoulettePrizeDto[]) => Promise<RouletteItem[]>
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
      KakuhenHandler.startKakuhenDummyDraw(
        preDrawResult,
        prizes,
        loadBgmBlob,
        animationRef,
        kakuhenInProgress,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        preparePrizes,
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
      KakuhenHandler.showDummyPrizeDialogAction(
        showPrizeWinningDialog,
        latestResult,
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
      KakuhenHandler.closeDummyPrizeDialogAction(
        showPrizeWinningDialog,
        latestResult,
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
        preparePrizes,
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
    prizes: Ref<RoulettePrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenDummyPrize: Ref<RoulettePrizeDto | null>,
    kakuhenFinalPrize: Ref<RoulettePrizeDto | null>,
    preparePrizes: (newPrizes: RoulettePrizeDto[]) => Promise<RouletteItem[]>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenDummyDraw");
    const res = preDrawResult.value!;
    const finalPrizeId = res.wonPrize!.id;
    // note: kakuhenFinalPrize.value will be set to the second clone below
    // store previous prizes so we can restore it later
    KakuhenHandler._prevPrizes = prizes.value.slice();
    // For kakuhen, duplicate the final prize entry so it appears twice on the wheel
    // first occurrence will display imageAssetId (画像1)
    // second occurrence will display image2AssetId (画像2)
    const newPrizes: RoulettePrizeDto[] = [];
    for (const p of prizes.value) {
      if (p.id === finalPrizeId) {
        // create distinct visual ids for the two duplicate sectors
        const firstClone: RoulettePrizeDto = {
          ...p,
          id: `${p.id}__k1`,
          imageAssetId: p.imageAssetId,
          originalPrizeId: p.id,
        };
        const secondClone: RoulettePrizeDto = {
          ...p,
          id: `${p.id}__k2`,
          imageAssetId: p.image2AssetId,
          originalPrizeId: p.id,
        };
        newPrizes.push(firstClone);
        newPrizes.push(secondClone);
        kakuhenDummyPrize.value = firstClone;
        kakuhenFinalPrize.value = secondClone;
      } else {
        newPrizes.push(p);
      }
    }
    const prepared = await preparePrizes(newPrizes);
    KakuhenHandler._kakuhenPrepared = prepared as any;
    // also ensure the animation internal items are updated if animationRef exposes updatePrizes
    try {
      if (animationRef.value?.updatePrizes && prepared) {
        await animationRef.value.updatePrizes(prepared);
      }
    } catch (e) {
      console.warn("Failed to update animationRef prepared items directly", e);
    }
    // wait a short moment for the animation component to update its internal items
    // (convertToInternal) so the stopSpin call below can find the duplicated sector occurrences
    await new Promise((r) => setTimeout(r, 60));
    const bgm1AssetId = kakuhenFinalPrize.value?.bgm1AssetId || null;
    const bgm1Blob = await loadBgmBlob(bgm1AssetId);
    console.log(
      "[KakuhenHandler] startKakuhenDummyDraw: bgm1AssetId=",
      bgm1AssetId,
      "loadedBGM=",
      bgm1Blob ? { size: bgm1Blob.size, type: bgm1Blob.type } : null
    );
    kakuhenInProgress.value = true;
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgm1Blob);
    }
    emitter.emit("nextAction");
  }

  static async stopKakuhenDummyDraw(
    animationRef: Ref<any>,
    kakuhenDummyPrize: Ref<RoulettePrizeDto | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenDummyDraw");
    const dummyDurationMs = 2000;
    if (animationRef.value?.stopSpin) {
      // stopSpin occurrence=1 => land on the first occurrence (画像1)
      await animationRef.value.stopSpin(
        dummyDurationMs / 1000,
        kakuhenDummyPrize.value?.id || null,
        1
      );
    }
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

  static async showDummyPrizeDialogAction(
    showDummyPrizeDialog: Ref<boolean>,
    latestResult: Ref<DrawResultDto | null>,
    kakuhenDummyPrize: Ref<RoulettePrizeDto | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] showDummyPrizeDialogAction");
    // store previous prize so we can restore it later
    KakuhenHandler._prevPrize = latestResult.value
      ? latestResult.value.wonPrize
      : null;
    // set the dummy prize for display in the prize dialog
    if (latestResult.value) {
      // show the clone (画像1) in the dialog by storing a copy
      latestResult.value.wonPrize = kakuhenDummyPrize.value || null;
    }
    showDummyPrizeDialog.value = true;
    await new Promise((r) => setTimeout(r, 3000));
    emitter.emit("nextAction");
  }

  static async closeDummyPrizeDialogAction(
    showDummyPrizeDialog: Ref<boolean>,
    latestResult: Ref<DrawResultDto | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] closeDummyPrizeDialogAction");
    showDummyPrizeDialog.value = false;
    // restore previously stored prize
    if (latestResult.value) {
      latestResult.value.wonPrize = KakuhenHandler._prevPrize || null;
    }
    KakuhenHandler._prevPrize = null;
    emitter.emit("nextAction");
  }

  static async startKakuhenFinalDraw(
    kakuhenFinalPrize: Ref<RoulettePrizeDto | null>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenFinalDraw");
    const bgm2AssetId = kakuhenFinalPrize.value?.bgm2AssetId || null;
    const bgm2Blob = await loadBgmBlob(bgm2AssetId);
    console.log(
      "[KakuhenHandler] startKakuhenFinalDraw: bgm2AssetId=",
      bgm2AssetId,
      "loadedBGM=",
      bgm2Blob ? { size: bgm2Blob.size, type: bgm2Blob.type } : null
    );
    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgm2Blob);
    }
    await new Promise((r) => setTimeout(r, 1500));
    emitter.emit("nextAction");
  }

  static async stopKakuhenFinalDraw(
    animationRef: Ref<any>,
    kakuhenFinalPrize: Ref<RoulettePrizeDto | null>,
    updateSelectedPrize: (prize: RoulettePrizeDto) => void,
    kakuhenInProgress: Ref<boolean>,
    latestResult: Ref<DrawResultDto | null>,
    preparePrizes: (newPrizes: RoulettePrizeDto[]) => Promise<RouletteItem[]>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenFinalDraw");
    const finalDurationMs = 5000;
    if (animationRef.value?.stopSpin) {
      try {
        // Ensure animator internal items are in sync and log for diagnostics.
        let internalItems: any[] | undefined;
        // synchronize animator's internal items and capture them for candidate checks
        try {
          if (animationRef.value?.updatePrizes) {
            if (KakuhenHandler._kakuhenPrepared) {
              await animationRef.value.updatePrizes(
                KakuhenHandler._kakuhenPrepared
              );
            } else if (KakuhenHandler._prevPrizes) {
              const restoredPrepared = await preparePrizes(
                KakuhenHandler._prevPrizes || []
              );
              await animationRef.value.updatePrizes(restoredPrepared);
            }
          }
          if (animationRef.value?.getInternalItems) {
            internalItems = animationRef.value.getInternalItems();
          }
        } catch (e) {
          // Ignore; it's best-effort and we do not change flow
        }

        // If internalItems available, check whether there are matching entries
        if (internalItems) {
          const candidates = internalItems.filter(
            (it) => it.id === kakuhenFinalPrize.value!.id
          );
          if (candidates.length === 0) {
            console.warn(
              "KakuhenHandler: no candidates for final prize id in internal items; falling back to last item",
              internalItems.map((i) => ({ id: i.id, name: i.name }))
            );
            const fallback = internalItems[internalItems.length - 1];
            await animationRef.value.stopSpin(
              finalDurationMs / 1000,
              fallback.id,
              1
            );
          } else {
            await animationRef.value.stopSpin(
              finalDurationMs / 1000,
              kakuhenFinalPrize.value!.id,
              2
            );
          }
        } else {
          // fallback: just try to stop with the id and occurrence=2 (original flow)
          await animationRef.value.stopSpin(
            finalDurationMs / 1000,
            kakuhenFinalPrize.value!.id,
            2
          );
        }
      } catch (e) {
        console.warn("KakuhenHandler: stopKakuhenFinalDraw stopSpin failed", e);
        // rethrow to be handled by outer executor
        throw e;
      }
    }
    kakuhenInProgress.value = false;
    // restore original prizes (remove duplicate entries)
    if (KakuhenHandler._prevPrizes) {
      const restoredPrepared = await preparePrizes(KakuhenHandler._prevPrizes);
      try {
        if (animationRef.value?.updatePrizes && restoredPrepared) {
          await animationRef.value.updatePrizes(restoredPrepared);
        }
      } catch (e) {
        console.warn(
          "Failed to update animationRef prepared items on restore",
          e
        );
      }
      // set selectedPrize based on restored prizes
      const restored = KakuhenHandler._prevPrizes.find(
        (p: RoulettePrizeDto) =>
          p.id ===
          (kakuhenFinalPrize.value!.originalPrizeId ||
            kakuhenFinalPrize.value!.id)
      )!;
      updateSelectedPrize(restored);
      // show final image (画像2) in the final prize dialog, but keep selectedPrize as original restored prize.
      latestResult.value!.wonPrize = {
        ...restored,
        imageAssetId: restored.image2AssetId || restored.imageAssetId,
      } as PrizeDto;
      KakuhenHandler._prevPrizes = null;
      KakuhenHandler._kakuhenPrepared = null;
    }
    emitter.emit("nextAction");
  }
}
