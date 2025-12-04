import type { Ref } from "vue";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";
import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";
import { type Emitter } from "mitt";
import { RouletteBgmManager } from "./roulette/roulette-bgm-manager";
import type { RouletteItem } from "./roulette/roulette-image-loader";
import type { RoulettePrizeDto } from "./roulette/roulette-prize-preparer";
import type { DrawPrizeResponse } from "@model/applications/draw/dto/draw-prize-response";

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
    preparePrizes: (newPrizes: RoulettePrizeDto[]) => Promise<RouletteItem[]>,
    prizeRes: DrawPrizeResponse | null
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
        prizes,
        loadBgmBlob,
        animationRef,
        kakuhenInProgress,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        preparePrizes,
        emitter,
        prizeRes
      )
    );
    baseActions.push(() => BaseHandler.wait(1));
    baseActions.push(() =>
      KakuhenHandler.stopKakuhenDummyDraw(
        animationRef,
        kakuhenDummyPrize,
        loadBgmBlob,
        emitter
      )
    );
    baseActions.push(() =>
      KakuhenHandler.showDummyPrizeDialogAction(
        showPrizeWinningDialog,
        latestResult,
        kakuhenDummyPrize,
        emitter,
        updateSelectedPrize
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
        emitter,
        updateSelectedPrize
      )
    );
    baseActions.push(() =>
      KakuhenHandler.startKakuhenFinalDraw(
        kakuhenFinalPrize,
        loadBgmBlob,
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
        loadBgmBlob,
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
    prizes: Ref<RoulettePrizeDto[]>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    animationRef: Ref<any>,
    kakuhenInProgress: Ref<boolean>,
    kakuhenDummyPrize: Ref<RoulettePrizeDto | null>,
    kakuhenFinalPrize: Ref<RoulettePrizeDto | null>,
    preparePrizes: (newPrizes: RoulettePrizeDto[]) => Promise<RouletteItem[]>,
    emitter: Emitter<any>,
    prizeRes: DrawPrizeResponse | null
  ) {
    console.log("[DrawOrchestrator] startKakuhenDummyDraw");
    // store previous prizes so we can restore it later
    KakuhenHandler._prevPrizes = prizes.value.slice();
    // For kakuhen, filter to display only winner + dummy prizes, and duplicate the winner
    const displayIds = [
      prizeRes?.winnerPrizeId,
      prizeRes?.dummyWinnerPrizeId,
      ...(prizeRes?.dummyPrizeIds || []),
    ].filter(Boolean) as string[];
    const newPrizes: RoulettePrizeDto[] = [];
    for (const id of displayIds) {
      const p = prizes.value.find((p) => p.id === id);
      if (!p) continue;
      if (p.id === prizeRes?.winnerPrizeId) {
        // create distinct visual ids for the two duplicate sectors
        const firstClone: RoulettePrizeDto = {
          ...p,
          id: `${p.id}__k1`,
          imageAssetId: p.imageAssetId,
          originalPrizeId: p.id,
          winningImage1AssetId: p.winningImage1AssetId || p.imageAssetId,
          winningImage2AssetId: undefined,
        };
        const secondClone: RoulettePrizeDto = {
          ...p,
          id: `${p.id}__k2`,
          imageAssetId: p.image2AssetId,
          originalPrizeId: p.id,
          winningImage1AssetId: p.winningImage2AssetId || p.image2AssetId,
          winningImage2AssetId: undefined,
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
    // Preload BGM1 for dummy draw (play on stop)
    try {
      const bgm1AssetId = kakuhenDummyPrize.value?.bgm1AssetId || null;
      const bgm1Blob = await RouletteBgmManager.load(bgm1AssetId, loadBgmBlob);
      console.log(
        "[KakuhenHandler] startKakuhenDummyDraw: preloaded bgm1AssetId=",
        bgm1AssetId,
        "loadedBGM=",
        bgm1Blob ? { size: bgm1Blob.size, type: bgm1Blob.type } : null
      );
    } catch (e) {
      console.warn("[KakuhenHandler] failed to preload bgm1", e);
    }
    kakuhenInProgress.value = true;
    emitter.emit("nextAction");
  }

  static async stopKakuhenDummyDraw(
    animationRef: Ref<any>,
    kakuhenDummyPrize: Ref<RoulettePrizeDto | null>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenDummyDraw");
    const dummyDurationMs = 2000;
    if (animationRef.value?.stopSpin) {
      // Play preloaded bgm1 (if any) then stopSpin occurrence=1 => land on first occurrence (画像1)
      try {
        const bgm1AssetId = kakuhenDummyPrize.value?.bgm1AssetId || null;
        await RouletteBgmManager.playAsset(bgm1AssetId, loadBgmBlob);
      } catch (e) {
        console.warn("KakuhenHandler: failed to play bgm for dummy draw", e);
      }
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
    // Register the finished listener before making the overlay visible to avoid
    // a race where the overlay dispatches the event before the handler is
    // listening.
    await new Promise<void>((resolve) => {
      let settled = false;
      const cleanup = () => {
        try {
          window.removeEventListener(
            "kakuhen.finished",
            onFinished as EventListener
          );
        } catch (e) {
          /* noop */
        }
        if (timer) {
          clearTimeout(timer);
        }
      };

      const onFinished = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }, 2000);

      try {
        window.addEventListener(
          "kakuhen.finished",
          onFinished as EventListener
        );
      } catch (e) {
        // addEventListener failed; fallback timer will be used
      }

      // Now that the listener is registered, show the overlay.
      kakuhenMessageVisible.value = true;
    });

    // After animation completes, hold visible for 1 second before proceeding.
    await new Promise((r) => setTimeout(r, 1000));
    emitter.emit("nextAction");
  }

  static async hideKakuhenMessage(
    kakuhenMessageVisible: Ref<boolean>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] hideKakuhenMessage");
    kakuhenMessageVisible.value = false;
    // Wait for the overlay fade transition to complete. The overlay dispatches
    // a window CustomEvent 'kakuhen.dismissed' in its after-leave hook. Use a
    // fallback timeout (1.5s) to avoid stalling the queue.
    await new Promise<void>((resolve) => {
      let settled = false;
      const cleanup = () => {
        try {
          window.removeEventListener("kakuhen.dismissed", onDismissed);
        } catch (e) {
          /* noop */
        }
        if (timer) {
          clearTimeout(timer);
        }
      };

      const onDismissed = () => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      };

      const timer = window.setTimeout(() => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve();
      }, 1500);

      try {
        window.addEventListener("kakuhen.dismissed", onDismissed);
      } catch (e) {
        // fallback
      }
    });

    // After dismissed, wait an additional 0.5s then proceed to nextAction.
    await new Promise((r) => setTimeout(r, 500));
    emitter.emit("nextAction");
  }

  static async showDummyPrizeDialogAction(
    showDummyPrizeDialog: Ref<boolean>,
    latestResult: Ref<DrawResultDto | null>,
    kakuhenDummyPrize: Ref<RoulettePrizeDto | null>,
    emitter: Emitter<any>,
    updateSelectedPrize: (prize: PrizeDto) => void
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
      // ensure the UI's selectedPrize used by DrawResultDialog is the dummy clone
      try {
        if (kakuhenDummyPrize.value) {
          updateSelectedPrize(kakuhenDummyPrize.value as PrizeDto);
        }
      } catch (e) {
        console.warn(
          "updateSelectedPrize failed in showDummyPrizeDialogAction",
          e
        );
      }
    }
    // Stop any playing BGM when the dummy prize dialog is shown
    try {
      await RouletteBgmManager.stop();
    } catch (e) {
      console.warn(
        "[KakuhenHandler] failed to stop bgm before showing dummy dialog",
        e
      );
    }
    showDummyPrizeDialog.value = true;
    await new Promise((r) => setTimeout(r, 3000));
    emitter.emit("nextAction");
  }

  static async closeDummyPrizeDialogAction(
    showDummyPrizeDialog: Ref<boolean>,
    latestResult: Ref<DrawResultDto | null>,
    emitter: Emitter<any>,
    updateSelectedPrize: (prize: PrizeDto) => void
  ) {
    console.log("[DrawOrchestrator] closeDummyPrizeDialogAction");
    showDummyPrizeDialog.value = false;
    // restore previously stored prize
    if (latestResult.value) {
      latestResult.value.wonPrize = KakuhenHandler._prevPrize || null;
    }
    // restore the UI selectedPrize as well
    try {
      if (KakuhenHandler._prevPrize) {
        updateSelectedPrize(KakuhenHandler._prevPrize as PrizeDto);
      }
    } catch (e) {
      console.warn(
        "updateSelectedPrize failed in closeDummyPrizeDialogAction",
        e
      );
    }
    KakuhenHandler._prevPrize = null;
    emitter.emit("nextAction");
  }

  static async startKakuhenFinalDraw(
    kakuhenFinalPrize: Ref<RoulettePrizeDto | null>,
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] startKakuhenFinalDraw");
    const bgm2AssetId = kakuhenFinalPrize.value?.bgm2AssetId || null;
    try {
      const bgm2Blob = await RouletteBgmManager.load(bgm2AssetId, loadBgmBlob);
      console.log(
        "[KakuhenHandler] startKakuhenFinalDraw: preloaded bgm2AssetId=",
        bgm2AssetId,
        "loadedBGM=",
        bgm2Blob ? { size: bgm2Blob.size, type: bgm2Blob.type } : null
      );
    } catch (e) {
      console.warn("[KakuhenHandler] failed to preload bgm2", e);
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
    loadBgmBlob: (assetId: string | null) => Promise<Blob | null>,
    emitter: Emitter<any>
  ) {
    console.log("[DrawOrchestrator] stopKakuhenFinalDraw");
    const finalDurationMs = 5000;
    // Play preloaded bgm2 before final stopSpin
    try {
      const bgm2AssetId = kakuhenFinalPrize.value?.bgm2AssetId || null;
      await RouletteBgmManager.playAsset(bgm2AssetId, loadBgmBlob);
    } catch (e) {
      console.warn(
        "[DrawOrchestrator] stopKakuhenFinalDraw: failed to play bgm",
        e
      );
    }
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
      // set selectedPrize to kakuhenFinalPrize (画像2のみ) for dialog display
      if (kakuhenFinalPrize.value) {
        console.log(
          "[KakuhenHandler] setting selectedPrize to kakuhenFinalPrize for dialog display",
          kakuhenFinalPrize.value
        );
        updateSelectedPrize(kakuhenFinalPrize.value);
      }
      // set selectedPrize based on restored prizes after dialog closes
      const restored = KakuhenHandler._prevPrizes.find(
        (p: RoulettePrizeDto) =>
          p.id ===
          (kakuhenFinalPrize.value!.originalPrizeId ||
            kakuhenFinalPrize.value!.id)
      )!;
      // show final image (画像2) in the final prize dialog, but keep selectedPrize as original restored prize.
      // Ensure only the second winning image is exposed to the dialog (clear winningImage1).
      latestResult.value!.wonPrize = {
        ...restored,
        imageAssetId: undefined,
        winningImage1AssetId: undefined,
        winningImage2AssetId: restored.winningImage2AssetId,
      } as PrizeDto;
      // ダイアログ終了後に元に戻す
      // setTimeout(() => {
      //   updateSelectedPrize(restored);
      // }, 3000); // ダイアログ表示時間に合わせて調整
      KakuhenHandler._prevPrizes = null;
      KakuhenHandler._kakuhenPrepared = null;
    }
    emitter.emit("nextAction");
  }
}
