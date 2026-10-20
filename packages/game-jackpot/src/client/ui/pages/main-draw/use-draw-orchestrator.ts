import { ref, onMounted, onUnmounted, shallowRef, markRaw } from "vue";
import type { Component } from "vue";
import { container } from "tsyringe";
import { useRouter } from "vue-router";
import { DrawApplicationService } from "@control/draw/draw-application-service";
import { PrizeRepository } from "@model/prize/prize-repository";
import { MemberRepository } from "@model/member/member-repository";
import { AssetDataService } from "@control/asset/asset-data-service";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import { parseKakuhenPlan } from "@model/draw/kakuhen-plan";
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
import { RouletteBgmManager } from "./roulette/roulette-bgm-manager";
import { revokePreparedPrizes } from "./roulette/roulette-prize-preparer";
import { createBgmBlobLoader } from "./bgm-blob-loader";
import type { DrawContext } from "./draw-context";
import { buildCycle } from "./draw-cycle";
import { DrawFlowController } from "./draw-flow-controller";
import { createHostPublisher } from "./host-publisher";
import { performDraw } from "./perform-draw";

// 本抽選画面の配線。画面の状態(ref)とサービスを集めて、進行(DrawFlowController)と
// ステップ(buildCycle)につなぐだけにして、ロジックは単体テストできるモジュール側に置く。
/** 抽選画面の進行役。メンバー抽選・景品抽選・確変・終了を、Enter(または遠隔の「次へ」)で順に進め、画面を離れたら受付・BGM・画像の URL をすべて片付ける。 */
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

  // 読み込み中に画面を離れた場合に、離れたあとでキー操作の受付や進行を始めないための印
  let disposed = false;

  onMounted(async () => {
    try {
      await updatePrizes(await prizeRepo.getPrizes());
      members.value = await memberRepo.getMembers();
      // 確変にする回は、管理画面の設定（本抽選画面設定）に従って、この抽選を始めるときに決める
      const mainSettings = await container.resolve(ScreenSettingsService).fetchScreenSetting("main", "main-screen-settings");
      await drawService.initializeStateIfNeeded(prizes.value, parseKakuhenPlan(mainSettings));
    } catch (e) {
      console.error("[DrawOrchestrator] failed to load draw data", e);
      alertError(e);
      return;
    }
    if (disposed) return;
    window.addEventListener("keydown", handleKeyDown);
    flow.ready = true;
    advance();
  });

  // 画面を離れたら、キー操作の受付を止め、進行を止め、鳴らしているルーレットの BGM を止め、
  // 景品の画像のURLを破棄する（離れたあとに BGM が鳴り続けたり、URLが残ったりしないように）。
  onUnmounted(() => {
    disposed = true;
    window.removeEventListener("keydown", handleKeyDown);
    flow.ready = false;
    void RouletteBgmManager.stop();
    revokePreparedPrizes(preparedPrizes.value);
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
