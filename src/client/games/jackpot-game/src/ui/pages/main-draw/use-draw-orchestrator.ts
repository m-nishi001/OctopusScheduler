import {
  ref,
  onMounted,
  onUnmounted,
  reactive,
  shallowRef,
  markRaw,
} from "vue";
import type { Component } from "vue";
import { DrawApplicationService } from "@model/applications/draw/draw-application-service";
import { PrizeRepository } from "@model/infrastructures/prize-repository";
import { MemberRepository } from "@model/infrastructures/member-repository";
import type { MemberDto } from "@model/applications/member/dto/member-dto";
import type { DrawResultDto } from "@model/applications/draw/dto/draw-result-dto";
import { container } from "tsyringe";
import { AssetDataService } from "@model/applications/asset/asset-data-service";
import { usePrizeDrawState } from "./prize-animation-state";
import SlotAnimation from "./slot/slot-animation.vue";
import RouletteAnimation from "./roulette/roulette-animation.vue";

import type { PrizeDto } from "@model/applications/prize/dto/prize-dto";

import { ActionQueue } from "./action-queue";
import { BaseHandler } from "./base-handler";
import { KakuhenHandler } from "./kakuhen-handler";
import mitt from "mitt";

// This composable extracts the heavy orchestration logic from the Vue SFC
// so the component can stay thin and focused on template/registration.
export function useDrawOrchestrator() {
  const members = ref<MemberDto[]>([]);
  const latestResult = ref<DrawResultDto | null>(null);
  const emitter = mitt<any>();
  const drawState = reactive({
    phase: "idle" as string,
    prizeAnimationStopped: false,
    currentAction: null as (() => void) | null,
    currentQueue: new ActionQueue(),
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
  const showMemberWinnerDialog = ref(false);

  const kakuhenInProgress = ref(false);
  const kakuhenOverlayVisible = ref(false);
  const preDrawResult = ref<DrawResultDto | null>(null);

  const currentMemberComponent = ref("MemberDrawAnimation");
  const currentPrizeComponent = shallowRef<Component>(
    markRaw(RouletteAnimation)
  );

  // Define action cycles
  const kakuhenDummyPrize = ref<PrizeDto | null>(null);
  const kakuhenFinalPrize = ref<PrizeDto | null>(null);

  const keyDownHandler = ref<((ev: KeyboardEvent) => void) | null>(null);

  const loadBgmBlob = async (assetId: string | null): Promise<Blob | null> => {
    if (!assetId) return null;
    try {
      const asset = await assetService.getAssetDataById(assetId);
      return asset?.blob || null;
    } catch (e) {
      console.log("[DrawOrchestrator] loadBgmBlob failed", e);
      return null;
    }
  };

  // executeDraw moved here from BaseHandler to use local refs/services
  const executeDraw = async () => {
    console.log("[DrawOrchestrator] executeDraw");
    try {
      const res = await drawService.executeDraw({
        memberRequestCount: 10,
        prizeRequestCount: 8,
      });
      console.log("[DrawOrchestrator] draw result received", { res });
      preDrawResult.value = res;
      latestResult.value = res;
      latestResult.value.wonPrize = prizes.value.find(
        (p: PrizeDto) => p.id === res.wonPrize!.id
      )!;
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
    } finally {
      console.log("[DrawOrchestrator] executeDraw completed");
      emitter.emit("nextAction");
    }
  };

  const getCycle = (isKakuhen: boolean) => {
    if (isKakuhen) {
      return KakuhenHandler.getActions(
        preDrawResult,
        memberAnimRef,
        animationRef,
        latestResult,
        prizes,
        showPrizeWinningDialog,
        drawService,
        showHalfRemainingDialog,
        showEndDialog,
        updateSelectedPrize,
        loadBgmBlob,
        kakuhenDummyPrize,
        kakuhenFinalPrize,
        kakuhenInProgress,
        kakuhenOverlayVisible,
        showMemberWinnerDialog,
        drawState.currentQueue,
        emitter,
        drawState
      );
    } else {
      return BaseHandler.getActions(
        preDrawResult,
        selectedPrize,
        memberAnimRef,
        animationRef,
        prizes,
        showPrizeWinningDialog,
        drawService,
        showHalfRemainingDialog,
        showEndDialog,
        updateSelectedPrize,
        loadBgmBlob,
        showMemberWinnerDialog,
        drawState.currentQueue,
        emitter,
        drawState
      );
    }
  };

  const isQueueExecuting = ref(false);
  const pendingAutoExecution = ref(false);

  const executeCurrentAction = async () => {
    if (isQueueExecuting.value || pendingAutoExecution.value) {
      return;
    }
    isQueueExecuting.value = true;

    // キューが空なら次のサイクルを追加
    if (drawState.currentQueue.isEmpty()) {
      try {
        const count = await drawService.getLastPrizeCount();
        if (count.remaining <= 0) {
          isQueueExecuting.value = false;
          return;
        }
        await executeDraw();
        const isKakuhen = preDrawResult.value?.isKakuhen || false;
        drawState.currentQueue.addCycle(getCycle(isKakuhen));
      } catch (e) {
        console.error("Failed to get prize count for cycle addition:", e);
        isQueueExecuting.value = false;
        return;
      } finally {
        // サイクルを追加した時は初期表示と同じ状態であるはず。
        // つまり、自動実行フラグはリセットしておく必要がある。
        pendingAutoExecution.value = false;
      }
    }
    try {
      const action = drawState.currentQueue.dequeue();
      if (!action) {
        console.warn("No action to execute in the queue");
        isQueueExecuting.value = false;
        return;
      }
      console.log("[DrawOrchestrator] Executing action from queue");
      await action();
    } catch (e) {
      console.error("Error executing action from queue", e);
    } finally {
      isQueueExecuting.value = false;
      if (pendingAutoExecution.value) {
        console.log("[DrawOrchestrator] Auto-executing next action");
        pendingAutoExecution.value = false;
        void executeCurrentAction();
      }
    }
  };

  onMounted(async () => {
    const loadedPrizes = await prizeRepo.getPrizes();
    await updatePrizes(loadedPrizes);
    members.value = await memberRepo.getMembers();

    await drawService.initializeStateIfNeeded(prizes.value);

    currentMemberComponent.value = "MemberDrawAnimation";

    await executeDraw();

    const isKakuhen = preDrawResult.value?.isKakuhen || false;
    drawState.currentQueue.addCycle(getCycle(isKakuhen));

    const handleKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === "Enter") {
        void executeCurrentAction();
      }
    };
    keyDownHandler.value = handleKeyDown;
    window.addEventListener("keydown", handleKeyDown);

    emitter.on("nextAction", () => {
      pendingAutoExecution.value = true;
    });

    void executeCurrentAction();
  });

  onUnmounted(() => {
    if (keyDownHandler.value) {
      window.removeEventListener("keydown", keyDownHandler.value);
    }
    emitter.off("nextAction");
  });

  return {
    prizes,
    members,
    latestResult,
    drawState,
    memberAnimRef,
    animationRef,
    selectedPrize,
    currentPrizeComponent,
    showPrizeWinningDialog,
    showHalfRemainingDialog,
    showEndDialog,
    showMemberWinnerDialog,
    kakuhenInProgress,
    kakuhenOverlayVisible,
  } as const;
}
