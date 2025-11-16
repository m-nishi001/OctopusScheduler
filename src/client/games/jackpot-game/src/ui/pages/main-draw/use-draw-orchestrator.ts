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

  const kakuhenInProgress = ref(false);
  const kakuhenOverlayVisible = ref(false);
  const preDrawResult = ref<DrawResultDto | null>(null);

  const currentMemberComponent = ref("MemberDrawAnimation");
  const currentPrizeComponent = shallowRef<Component>(
    markRaw(RouletteAnimation)
  );

  // timestamped console for debug (kept local to composable)
  const enableTimestampedLogs = () => {
    const _origLog = console.log.bind(console);
    const _origWarn = console.warn.bind(console);
    const _origError = console.error.bind(console);
    console.log = (...args: unknown[]) =>
      _origLog(new Date().toISOString(), ...args);
    console.warn = (...args: unknown[]) =>
      _origWarn(new Date().toISOString(), ...args);
    console.error = (...args: unknown[]) =>
      _origError(new Date().toISOString(), ...args);
  };
  enableTimestampedLogs();

  const loadBgmBlob = async (assetId: string | null): Promise<Blob | null> => {
    console.log("[DrawOrchestrator] loadBgmBlob called", { assetId });
    if (!assetId) return null;
    try {
      const asset = await assetService.getAssetDataById(assetId);
      console.log("[DrawOrchestrator] loadBgmBlob loaded asset", {
        assetId,
        hasBlob: !!asset?.blob,
      });
      return asset?.blob || null;
    } catch (e) {
      console.log("[DrawOrchestrator] loadBgmBlob failed", e);
      return null;
    }
  };

  // kakuhen (special reroll) flow
  const handleKakuhenDraw = async (res: DrawResultDto) => {
    console.log("[DrawOrchestrator] handleKakuhenDraw called", { res });
    const finalPrizeId = res.wonPrize!.id;
    const finalPrize = prizes.value.find((p) => p.id === finalPrizeId)!;

    const dummyCandidates = prizes.value.filter((p) => p.id !== finalPrizeId);
    const dummyPrize = dummyCandidates.length
      ? dummyCandidates[Math.floor(Math.random() * dummyCandidates.length)]
      : null;

    const [bgm1Blob, bgm2Blob] = await Promise.all([
      loadBgmBlob(dummyPrize?.bgm1AssetId || null),
      loadBgmBlob(finalPrize.bgm2AssetId || null),
    ]);

    const dummyDurationMs = 2000;
    const finalDurationMs = 5000;

    kakuhenInProgress.value = true;
    let _kakuhenResolve: (() => void) | null = null;
    const _kakuhenCompleted = new Promise<void>((resolve) => {
      _kakuhenResolve = resolve;
    });
    try {
      try {
        if (animationRef.value?.startSpin) {
          animationRef.value.startSpin(bgm1Blob);
          console.log(
            "[DrawOrchestrator] handleKakuhenDraw started dummy spin",
            { dummyPrizeId: dummyPrize?.id }
          );
        }

        drawState.currentAction = async () => {
          try {
            try {
              inputController.suspend();
            } catch (e) {
              /* noop */
            }

            if (animationRef.value?.stopSpin) {
              await animationRef.value.stopSpin(
                dummyDurationMs / 1000,
                dummyPrize?.id || null
              );
              console.log(
                "[DrawOrchestrator] handleKakuhenDraw stopped dummy spin (via Enter)"
              );
            }

            await new Promise((r) => setTimeout(r, 3000));
            kakuhenOverlayVisible.value = true;
            console.log(
              "[DrawOrchestrator] handleKakuhenDraw showed kakuhen overlay (global)"
            );
            await new Promise((r) => setTimeout(r, 2000));

            try {
              showPrizeWinningDialog.value = false;
            } catch (e) {
              /* noop */
            }

            kakuhenOverlayVisible.value = false;
            await new Promise((r) => setTimeout(r, 1000));

            if (animationRef.value?.startSpin) {
              animationRef.value.startSpin(bgm2Blob);
              console.log(
                "[DrawOrchestrator] handleKakuhenDraw started final spin",
                { finalPrizeId }
              );
            }

            await new Promise((r) => setTimeout(r, 3000));

            if (animationRef.value?.stopSpin) {
              await animationRef.value.stopSpin(
                finalDurationMs / 1000,
                finalPrizeId
              );
              console.log(
                "[DrawOrchestrator] handleKakuhenDraw stopped final spin",
                { finalPrizeId }
              );
            }
          } catch (e) {
            console.warn("Kakuhen reroll sequence failed:", e);
          }

          updateSelectedPrize(finalPrize);

          await new Promise((r) => setTimeout(r, 1000));
          drawState.currentAction = () => {
            void closeModal();
          };
          try {
            inputController.resume();
          } catch (e) {
            /* noop */
          }
          kakuhenInProgress.value = false;
          try {
            _kakuhenResolve && _kakuhenResolve();
          } catch (e) {
            /* noop */
          }
          console.log(
            "[DrawOrchestrator] handleKakuhenDraw completed and enabled close action"
          );
        };

        console.log(
          "[DrawOrchestrator] handleKakuhenDraw waiting for Enter to stop dummy spin"
        );
        await _kakuhenCompleted;
      } catch (e) {
        console.warn("Kakuhen setup failed:", e);
      }
    } finally {
      if (kakuhenInProgress.value && !_kakuhenResolve) {
        kakuhenInProgress.value = false;
      }
    }
  };

  const handleNormalDraw = async (res: DrawResultDto) => {
    console.log("[DrawOrchestrator] handleNormalDraw called", { res });
    const winnerPrizeId = res.wonPrize!.id;
    updateSelectedPrize(prizes.value.find((p) => p.id === winnerPrizeId)!);

    const bgmBlob = await loadBgmBlob(selectedPrize.value!.bgm1AssetId || null);
    console.log("[DrawOrchestrator] handleNormalDraw bgm blob loaded", {
      winnerPrizeId,
      hasBgm: !!bgmBlob,
    });

    if (animationRef.value?.startSpin) {
      animationRef.value.startSpin(bgmBlob);
      console.log("[DrawOrchestrator] handleNormalDraw started spin", {
        winnerPrizeId,
      });
    }
  };

  const startRouletteAnimation = async (res: any) => {
    console.log("[DrawOrchestrator] startRouletteAnimation", { res });
    if (res.isKakuhen) {
      await handleKakuhenDraw(res);
    } else {
      await handleNormalDraw(res);
    }
  };

  let actionRunning = false;
  const executeCurrentAction = async () => {
    const action = drawState.currentAction;
    console.log("[DrawOrchestrator] executeCurrentAction called", {
      hasAction: !!action,
      actionRunning,
    });
    if (!action) {
      console.log("[DrawOrchestrator] executeCurrentAction no action to run");
      return;
    }
    if (actionRunning) {
      console.log(
        "[DrawOrchestrator] executeCurrentAction already running, skipping"
      );
      return;
    }

    drawState.currentAction = null;
    actionRunning = true;
    try {
      console.log("[DrawOrchestrator] executeCurrentAction starting action");
      await Promise.resolve(action());
      console.log("[DrawOrchestrator] executeCurrentAction action finished");
    } catch (e) {
      console.error("Error executing currentAction", e);
    } finally {
      actionRunning = false;
      console.log("[DrawOrchestrator] executeCurrentAction cleaned up");
    }
  };

  const inputController = createInputController({ minIntervalMs: 1000 });

  onMounted(async () => {
    console.log("[DrawOrchestrator] onMounted start");
    const loadedPrizes = await prizeRepo.getPrizes();
    console.log("[DrawOrchestrator] loaded prizes count", {
      count: loadedPrizes.length,
    });
    await updatePrizes(loadedPrizes);
    members.value = await memberRepo.getMembers();
    console.log("[DrawOrchestrator] loaded members count", {
      count: members.value.length,
    });

    await drawService.initializeStateIfNeeded(prizes.value);
    console.log("[DrawOrchestrator] initialized draw state if needed");

    try {
      const res = await drawService.executeDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });
      console.log("[DrawOrchestrator] pre-draw result received", { res });
      preDrawResult.value = res;
      latestResult.value = res;
      updateSelectedPrize(prizes.value.find((p) => p.id === res.wonPrize!.id)!);
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

    currentMemberComponent.value = "MemberDrawAnimation";

    showMemberDraw();

    inputController.setOnTrigger(() => {
      console.log("[DrawOrchestrator] inputController triggered Enter");
      void executeCurrentAction();
    });
    inputController.attach();
    console.log("[DrawOrchestrator] onMounted done, input controller attached");
  });

  const _dialogTimers: number[] = [];
  onUnmounted(() => {
    inputController.detach();
    for (const t of _dialogTimers)
      try {
        clearTimeout(t);
      } catch (e) {}
  });

  const showMemberDraw = () => {
    console.log("[DrawOrchestrator] showMemberDraw");
    drawState.phase = "member";
    drawState.currentAction = () => {
      void startMemberDraw();
    };
  };

  const handleMemberDrawStart = () => {
    console.log("[DrawOrchestrator] handleMemberDrawStart");
    void showMemberDraw();
  };

  const startMemberDraw = async () => {
    console.log("[DrawOrchestrator] startMemberDraw", {
      preDrawWinner: preDrawResult.value?.wonMember?.id,
    });
    if (memberAnimRef.value) {
      memberAnimRef.value.startDraw(preDrawResult.value?.wonMember?.id || null);
      console.log("[DrawOrchestrator] memberAnimRef.startDraw called");
    }
    drawState.currentAction = memberStop;
  };

  const onMemberRouletteStopped = () => {
    console.log("[DrawOrchestrator] onMemberRouletteStopped", {
      latestResult: latestResult.value,
    });
    drawState.currentAction = null;
  };

  const memberStop = async () => {
    console.log("[DrawOrchestrator] memberStop");
    if (memberAnimRef.value) {
      await memberAnimRef.value.stopDraw();
      console.log("[DrawOrchestrator] memberAnimRef.stopDraw completed");
    }
  };

  const showPrizeDraw = () => {
    console.log("[DrawOrchestrator] showPrizeDraw");
    drawState.phase = "prize";
    drawState.currentAction = () => {
      void startPrizeDraw();
    };
  };

  const startPrizeDraw = async () => {
    console.log("[DrawOrchestrator] startPrizeDraw", {
      preDrawResult: preDrawResult.value,
    });
    if (!preDrawResult.value) {
      console.log(
        "[DrawOrchestrator] startPrizeDraw no preDrawResult, resetting to member phase"
      );
      resetToMemberPhase();
      return;
    }
    await startRouletteAnimation(preDrawResult.value);
    console.log("[DrawOrchestrator] startPrizeDraw animation started");
    drawState.currentAction = prizeStop;
  };

  const prizeStop = async () => {
    console.log("[DrawOrchestrator] prizeStop", {
      selectedPrizeId: selectedPrize.value?.id,
    });
    if (animationRef.value?.stopSpin && selectedPrize.value) {
      await animationRef.value.stopSpin(3, selectedPrize.value.id);
      console.log("[DrawOrchestrator] prizeStop completed stopSpin");
    }
  };

  const resetToMemberPhase = () => {
    console.log("[DrawOrchestrator] resetToMemberPhase");
    drawState.phase = "member";
    drawState.currentAction = () => {
      void showMemberDraw();
    };
    showPrizeWinningDialog.value = false;
  };

  const openHalfRemainingDialog = () => {
    console.log("[DrawOrchestrator] openHalfRemainingDialog");
    showHalfRemainingDialog.value = true;
  };

  const onPrizeRouletteStopped = (prizeId: string | null) => {
    console.log("[DrawOrchestrator] onRouletteStopped", { prizeId });
    if (!prizeId) throw new Error("No prize selected");
    if (latestResult.value) {
      latestResult.value.wonPrize = prizes.value.find((p) => p.id === prizeId)!;
      showPrizeWinningDialog.value = true;
      drawState.currentAction = null;

      if (!kakuhenInProgress.value) {
        try {
          inputController.suspend();
        } catch (e) {
          /* noop */
        }
        const tid = window.setTimeout(() => {
          drawState.currentAction = () => {
            void closeModal();
          };
          try {
            inputController.resume();
          } catch (e) {
            /* noop */
          }
          console.log(
            "[DrawOrchestrator] prize dialog close action enabled after delay"
          );
        }, 1000);
        _dialogTimers.push(tid as unknown as number);
        // schedule half-remaining check after prize dialog has been visible
        const HALF_REMAINING_SHOW_DELAY_MS = 3000;
        const halfCheckTid = window.setTimeout(async () => {
          try {
            if (!showPrizeWinningDialog.value) return;
            const count = await drawService.getLastPrizeCount();
            if (
              count.total > 0 &&
              count.remaining > 0 &&
              count.remaining * 2 === count.total
            ) {
              console.log(
                "[DrawOrchestrator] half-remaining condition met after delay, opening dialog"
              );
              openHalfRemainingDialog();
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
        }, HALF_REMAINING_SHOW_DELAY_MS);
        _dialogTimers.push(halfCheckTid as unknown as number);
        console.log(
          "[DrawOrchestrator] onRouletteStopped updated latestResult",
          { latestResult: latestResult.value }
        );
      } else {
        console.log(
          "[DrawOrchestrator] onRouletteStopped (kakuhen) updated latestResult",
          { latestResult: latestResult.value }
        );
      }
    }
  };

  const onMemberWinnerDialogShown = () => {
    console.log("[DrawOrchestrator] onMemberWinnerDialogShown");
    inputController.suspend();
    drawState.currentAction = null;
    const tid = window.setTimeout(() => {
      drawState.currentAction = () => showPrizeDraw();
      inputController.resume();
      console.log(
        "[DrawOrchestrator] member winner action enabled after delay"
      );
    }, 1000);
    _dialogTimers.push(tid as unknown as number);
  };

  const onMemberWinnerDialogClosed = () => {
    console.log("[DrawOrchestrator] onMemberWinnerDialogClosed");
    try {
      inputController.resume();
    } catch (e) {}
  };

  const closeModal = async () => {
    console.log("[DrawOrchestrator] closeModal start");
    const count = await drawService.getLastPrizeCount();
    console.log("[DrawOrchestrator] closeModal prize count", { count });
    showEndDialog.value = count.remaining <= 0;
    showPrizeWinningDialog.value = false;
    drawState.currentAction = null;
    if (count.remaining <= 0) {
      console.log(
        "[DrawOrchestrator] closeModal detected end condition, showEndDialog set"
      );
    } else if (
      count.total > 0 &&
      count.remaining > 0 &&
      count.remaining * 2 === count.total
    ) {
      console.log("[DrawOrchestrator] closeModal half remaining condition met");
      openHalfRemainingDialog();
    } else {
      console.log("[DrawOrchestrator] closeModal starting next pre-draw");
      try {
        const res = await drawService.executeDraw({
          memberRequestCount: 10,
          prizeRequestCount: 8,
        });
        console.log("[DrawOrchestrator] closeModal pre-draw result", { res });
        preDrawResult.value = res;
        latestResult.value = res;
        const result = res;
        updateSelectedPrize(
          prizes.value.find((p) => p.id === result.wonPrize!.id)!
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
        prizes.value.find((p) => p.id === result.wonPrize!.id)!
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
    console.log("[DrawOrchestrator] onEndClosed");
    showEndDialog.value = false;
    showHalfRemainingDialog.value = false;
    router.push("/jackpot-ending");
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
    startPrizeDraw,
    prizeStop,
    closeModal,
    onPrizeRouletteStopped,
    onMemberRouletteStopped,
    showPrizeWinningDialog,
    showHalfRemainingDialog,
    showEndDialog,
    onHalfRemainingClosed,
    onEndClosed,
    handleMemberDrawStart,
    onMemberWinnerDialogShown,
    onMemberWinnerDialogClosed,
    kakuhenInProgress,
    kakuhenOverlayVisible,
  } as const;
}
