import { ref, onMounted, onUnmounted, shallowRef, markRaw } from "vue";
import type { Component } from "vue";
import { container } from "tsyringe";
import { useRouter } from "vue-router";
import { DrawApplicationService } from "@control/draw/draw-application-service";
import { PrizeRepository } from "@model/prize/prize-repository";
import { MemberRepository } from "@model/member/member-repository";
import { AssetDataService } from "@control/asset/asset-data-service";
import type { MemberDto } from "@control/member/dto/member-dto";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";
import type { DrawMemberResponse } from "@control/draw/dto/draw-member-response";
import type { DrawPrizeResponse } from "@control/draw/dto/draw-prize-response";
import type { DrawEndReason } from "@control/draw/dto/draw-progress";
import { RevealTracker } from "@model/jackpot-host-state";
import { useJackpotHost } from "../../composables/use-jackpot-host";
import { useJackpotSession } from "../../composables/use-jackpot-session";
import { usePrizeDrawState } from "./prize-animation-state";
import SlotAnimation from "./slot/slot-animation.vue";
import RouletteAnimation from "./roulette/roulette-animation.vue";
import { ActionQueue } from "./action-queue";
import { createBgmBlobLoader } from "./bgm-blob-loader";
import type { DrawContext } from "./draw-context";
import { buildCycle } from "./draw-cycle";
import { DrawFlowController } from "./draw-flow-controller";
import { createHostPublisher } from "./host-publisher";
import { performDraw } from "./perform-draw";

// 本抽選画面の配線。画面の状態(ref)とサービスを集めて、進行(DrawFlowController)と
// ステップ(buildCycle)につなぐだけにして、ロジックは単体テストできるモジュール側に置く。
export function useDrawOrchestrator() {
  const prizeRepo = container.resolve(PrizeRepository);
  const memberRepo = container.resolve(MemberRepository);
  const drawService = container.resolve(DrawApplicationService);
  const assetService = container.resolve(AssetDataService);
  const { isDemo, to } = useJackpotSession();
  const router = useRouter();

  const { prizes, selectedPrize, preparedPrizes, updatePrizes, preparePrizes, updateSelectedPrize } =
    usePrizeDrawState(assetService);

  const members = ref<MemberDto[]>([]);
  const phase = ref("idle");
  const latestResult = ref<DrawResultDto | null>(null);
  const currentPrizeRes = ref<DrawPrizeResponse | null>(null);
  const currentMemberRes = ref<DrawMemberResponse | null>(null);
  const currentPrizeComponent = shallowRef<Component>(markRaw(RouletteAnimation));

  // 演出コンポーネント(テンプレート ref)
  const memberAnimRef = ref<any>(null);
  const animationRef = ref<any>(null);

  const showPrizeWinningDialog = ref(false);
  const showHalfRemainingDialog = ref(false);
  /** 抽選が終わっていれば理由(終了の画面を出す)。続けられるうちは null。 */
  const endReason = ref<DrawEndReason | null>(null);
  const kakuhenOverlayVisible = ref(false);

  const ctx: DrawContext = {
    drawService,
    phase,
    result: latestResult,
    prizeRes: currentPrizeRes,
    prizes,
    selectedPrize,
    setSelectedPrize: updateSelectedPrize,
    preparePrizes,
    loadBgmBlob: createBgmBlobLoader(assetService),
    memberAnim: memberAnimRef,
    prizeAnim: animationRef,
    showPrizeWinningDialog,
    showHalfRemainingDialog,
    kakuhenOverlayVisible,
  };

  // 参加者への公開用: 当選者を「停止演出が終わるまで」見せないために、どこまで見えたかを追跡する
  const queue = new ActionQueue();
  const revealTracker = new RevealTracker();
  queue.onDequeue = (label) => revealTracker.onAction(label);

  /** 抽選して画面の状態に反映し、そのサイクルのステップを返す。失敗したら例外(状態は何も反映しない)。 */
  const drawNextCycle = async () => {
    revealTracker.reset(); // 新しい抽選が始まったので、前回の当選者を参加者への公開から外す
    const { result, prizeRes, memberRes, winner } = await performDraw({ drawService, prizes, preparePrizes });
    latestResult.value = result;
    currentPrizeRes.value = prizeRes;
    currentMemberRes.value = memberRes;
    updateSelectedPrize(winner);
    currentPrizeComponent.value = markRaw(
      winner.animation === "slot" ? (SlotAnimation as Component) : RouletteAnimation
    );
    return buildCycle(ctx, result.isKakuhen ?? false);
  };

  const onDrawError = (e: unknown) => {
    console.error("[DrawOrchestrator] draw failed", e);
    latestResult.value = null;
    currentPrizeRes.value = null;
    currentMemberRes.value = null;
    alertError(e);
  };

  // セッションのホストとして接続している場合、管理端末の「次へ」と、ホストが許可した
  // 参加者のスマホからの「止める」をEnterキー押下と同じ扱いにし、抽選の状態を公開する。
  // onUnmountedを登録するため、必ずonMountedの外(setup()の同期実行中)で呼び出す。
  let flow: DrawFlowController;
  const advance = () => void flow.advance();
  const host = useJackpotHost({ advance, stopRoulette: advance });
  const publishHostState = createHostPublisher({
    host,
    tracker: revealTracker,
    isDemo,
    phase: () => phase.value,
    ended: () => endReason.value !== null,
    nextLabel: () => queue.peekLabel(),
    result: () => latestResult.value,
  });

  flow = new DrawFlowController({
    queue,
    progress: () => drawService.getDrawProgress(),
    drawNextCycle,
    onDrawError,
    onStepError: (e) => console.error("[DrawOrchestrator] step failed", e),
    onFinished: (reason) => {
      endReason.value = reason;
    },
    // 終了後の「次へ」・Enter・OK は、結果の画面へ進む(エンディングへは結果の画面から進む)
    onLeave: () => void router.push(to("/jackpot-result")),
    onSettled: publishHostState,
  });

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Enter") advance();
  };

  onMounted(async () => {
    try {
      await updatePrizes(await prizeRepo.getPrizes());
      members.value = await memberRepo.getMembers();
      await drawService.initializeStateIfNeeded(prizes.value);
    } catch (e) {
      console.error("[DrawOrchestrator] failed to load draw data", e);
      alertError(e);
      return;
    }
    window.addEventListener("keydown", handleKeyDown);
    flow.ready = true;
    advance();
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", handleKeyDown);
  });

  return {
    prizes,
    preparedPrizes,
    members,
    latestResult,
    phase,
    memberAnimRef,
    animationRef,
    selectedPrize,
    currentPrizeComponent,
    showPrizeWinningDialog,
    showHalfRemainingDialog,
    endReason,
    advance,
    kakuhenOverlayVisible,
    currentMemberRes,
  } as const;
}

function alertError(e: unknown) {
  try {
    window.alert((e as Error)?.message || String(e));
  } catch {
    /* noop */
  }
}
