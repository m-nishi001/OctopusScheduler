import { ref, onMounted, onUnmounted, shallowRef, markRaw } from "vue";
import type { Component } from "vue";
import { container } from "tsyringe";
import { useRouter } from "vue-router";
import { DrawApplicationService } from "@control/draw/draw-application-service";
import { PrizeRepository } from "@model/prize/prize-repository";
import { MemberRepository } from "@model/member/member-repository";
import { AssetDataService } from "@control/asset/asset-data-service";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import { parsePrizeStopSec, DEFAULT_PRIZE_STOP_SEC } from "@model/draw/prize-stop-sec";
import { parseKakuhenPlan, AUTO_KAKUHEN_PLAN, type KakuhenPlan } from "@model/draw/kakuhen-plan";
import { DrawConflictError } from "@model/errors";
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
import { DrawFlowController, type NextCycle } from "./draw-flow-controller";
import { createHostPublisher } from "./host-publisher";
import { performNext, performResume, type DrawOutcome, type NextCycleResult } from "./perform-draw";
import { CycleSource } from "./cycle-source";
import { MemberPhotoCache } from "@octopus/accounts";

/** メンバー抽選の画面が並べて見せる人数(member-draw-animation.vue の visibleCount の既定)。先に写真を読む範囲。 */
const MEMBER_REEL_VISIBLE = 10;

// 本抽選画面の配線。画面の状態(ref)とサービスを集めて、進行(DrawFlowController)と
// ステップ(buildCycle)につなぐだけにして、ロジックは単体テストできるモジュール側に置く。
/** 抽選画面の進行役。メンバー抽選・景品抽選・確変・終了を、Enter(または遠隔の「次へ」)で順に進め、画面を離れたら受付・BGM・画像の URL をすべて片付ける。 */
export function useDrawOrchestrator() {
  const prizeRepo = container.resolve(PrizeRepository);
  const memberRepo = container.resolve(MemberRepository);
  const drawService = container.resolve(DrawApplicationService);
  const assetService = container.resolve(AssetDataService);
  const { to } = useJackpotSession();
  const router = useRouter();

  const { prizes, selectedPrize, preparedPrizes, updatePrizes, preparePrizes, buildPrizeItems, installPreparedPrizes, updateSelectedPrize } =
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
  /** 終了の画面に出す、抽選の対象の人数。 */
  const eligibleMembers = ref<number | null>(null);
  /** 結果を保存しない実行(セッションの外・デモ)か。画面に「リハーサル」と出す。 */
  const rehearsal = ref(false);
  /** 画面に出す知らせ(別の端末で結果がリセットされた、など)。 */
  const notice = ref<string | null>(null);
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
    prizeStopSec: DEFAULT_PRIZE_STOP_SEC,
  };

  // 参加者への公開用: 当選者を「停止演出が終わるまで」見せないために、どこまで見えたかを追跡する
  const queue = new ActionQueue();
  const revealTracker = new RevealTracker();
  queue.onDequeue = (label) => revealTracker.onAction(label);

  /** 保存先から最後に読み直した時刻。 */
  let storeLoadedAtMs = 0;
  /**
   * 抽選の前に、保存先の状態を読み直す(別の端末で結果がリセットされた、などを取り込む。抽選1回につき通信1回)。
   * 画面を開いた直後に読んだばかりなら省く。
   */
  const refreshStore = async () => {
    if (Date.now() - storeLoadedAtMs < 2000) return;
    await drawService.store.load();
    storeLoadedAtMs = Date.now();
  };

  /** 管理画面の設定(本抽選画面設定)に従う、確変の予定の案。抽選の準備のときに読む。 */
  let kakuhenPlan: KakuhenPlan = AUTO_KAKUHEN_PLAN;

  /** 抽選の結果を画面の状態に反映し、そのサイクルのステップを返す。 */
  const applyOutcome = ({ result, prizeRes, memberRes, winner, prizeItems }: DrawOutcome) => {
    installPreparedPrizes(prizeItems);
    latestResult.value = result;
    currentPrizeRes.value = prizeRes;
    currentMemberRes.value = memberRes;
    updateSelectedPrize(winner);
    currentPrizeComponent.value = markRaw(
      winner.animation === "slot" ? (SlotAnimation as Component) : RouletteAnimation
    );
    return buildCycle(ctx, result.isKakuhen ?? false);
  };

  const performDeps = { drawService, prizes, buildPrizeItems };

  /**
   * 次のサイクルの材料を用意する(画面の状態には触れない。裏で先に走らせてもよい)。
   * 続けられるかの確認 → 抽選 → 保存先への確定(commit) → ルーレットの景品・メンバーの写真の下ごしらえ。
   * 確定できなかったとき(通信の失敗・矛盾)は例外。確定済みで未公開の抽選が残っていれば、引き直さずそれを材料にする。
   */
  const prepareNextCycle = async (): Promise<NextCycleResult> => {
    // 結果が別の端末でリセットされた後などは確変の予定が無いので、引く前に決め直す(メモリから見るだけで通信しない)
    if (!(await drawService.store.plan())) await drawService.initializeStateIfNeeded(prizes.value, kakuhenPlan);
    // 確定はできていたのに応答が届かなかった抽選など、まだ画面に見せていない確定済みの抽選があれば、引き直さずにそれを演出する
    const pending = await drawService.store.pending();
    const next: NextCycleResult =
      pending && pending.drawId !== latestResult.value?.drawId
        ? { kind: "draw", outcome: await performResume(performDeps, pending) }
        : await performNext(performDeps);
    if (next.kind === "draw") await preloadMemberImages(next.outcome.memberRes);
    return next;
  };

  /** メンバー抽選の画面で使う写真(当選者・ダミー・並べて見せる先頭のメンバー)を先に読む。画面を作る時点で読み終わっている。 */
  const preloadMemberImages = async (memberRes: DrawMemberResponse) => {
    const byId = new Map(members.value.map((m) => [m.id, m]));
    const shown = [memberRes.winnerId, ...memberRes.dummyIds].map((id) => (id ? byId.get(id) : undefined));
    const lead = members.value.slice(0, MEMBER_REEL_VISIBLE);
    await container.resolve(MemberPhotoCache).ensure([...shown, ...lead].map((m) => m?.photo));
  };

  /** 使わずに捨てる材料の後始末(ルーレットの画像の URL)。 */
  const discardPrepared = (prepared: NextCycleResult) => {
    if (prepared.kind === "draw") revokePreparedPrizes(prepared.outcome.prizeItems);
  };

  /**
   * 次のサイクルの材料の出どころ。公開(reveal)が済んだら裏で先に用意し、進行操作で即座に渡す。
   * 用意できていなければ、従来どおりその場で(保存先を読み直して)用意する。
   */
  const cycleSource = new CycleSource<NextCycleResult>({
    refresh: () => refreshStore(),
    settle: () => publishHostState.settled(),
    prepare: prepareNextCycle,
    discard: discardPrepared,
    onPrefetchError: (e) => console.warn("[DrawOrchestrator] next cycle prefetch failed; falling back to on-demand", e),
  });
  /** 先読みを作ったときの保存先(リハーサルとセッションの切り替えなどで別物になったら、先読みは使わない)。 */
  let prefetchedStore = drawService.store;

  /** 次のサイクルを、画面の状態に反映して進行役に渡す。 */
  const nextCycle = async (): Promise<NextCycle> => {
    revealTracker.reset(); // 新しい抽選が始まったので、前回の当選者を参加者への公開から外す
    if (prefetchedStore !== drawService.store) {
      cycleSource.invalidate();
      prefetchedStore = drawService.store;
    }
    const prepared = await cycleSource.next();
    if (prepared.kind === "finished") return prepared;
    return { kind: "cycle", steps: applyOutcome(prepared.outcome) };
  };

  /** 確定済みで未公開の抽選を、引き直さずに同じ結果で演出し直すステップを返す(ホストの再読み込み後)。 */
  const resumeCycle = async (pending: DrawResultDto) => {
    revealTracker.reset();
    const outcome = await performResume(performDeps, pending);
    await preloadMemberImages(outcome.memberRes);
    return applyOutcome(outcome);
  };

  const onDrawError = (e: unknown) => {
    console.error("[DrawOrchestrator] draw failed", e);
    latestResult.value = null;
    currentPrizeRes.value = null;
    currentMemberRes.value = null;
    cycleSource.invalidate(); // 先に用意したものは、読み直す前の状態の上に作ったもの
    // 保存先の状態を読み直しておく(矛盾の原因が別の端末の操作かもしれない。次の進行操作で、読み直した状態から引き直す)
    void drawService.store.load().catch((err) => console.error("[DrawOrchestrator] reload failed", err));
    alertError(e);
  };

  /**
   * 当選者と景品が画面に見えた抽選を公開する。結果が別の端末でリセットされていた(矛盾)ときは、
   * 読み直したうえで知らせ、再試行はしない。通信の失敗だけ false(次の公開でもう一度試す)。
   */
  const revealDraw = async (drawId: string): Promise<boolean> => {
    try {
      await drawService.store.reveal(drawId);
      return true;
    } catch (e) {
      if (e instanceof DrawConflictError) {
        console.error("[DrawOrchestrator] reveal conflict", e);
        notice.value = "別の端末で抽選の結果がリセットされたため、この抽選は参加者に公開されませんでした。状態を読み直しました。";
        cycleSource.invalidate();
        return true;
      }
      console.error("[DrawOrchestrator] reveal failed", e);
      return false;
    }
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
    reveal: revealDraw,
    // いまの抽選が公開されたので、次のサイクルを裏で用意し始める(サーバーは公開されていない抽選がある間は次の確定を断る)
    onRevealed: (drawId) => {
      if (!disposed && flow.ready && !flow.finished) cycleSource.prefetch(drawId);
    },
    phase: () => phase.value,
    ended: () => endReason.value !== null,
    nextLabel: () => queue.peekLabel(),
    result: () => latestResult.value,
  });

  flow = new DrawFlowController({
    queue,
    nextCycle,
    onDrawError,
    onStepError: (e) => console.error("[DrawOrchestrator] step failed", e),
    onFinished: (reason, progress) => {
      endReason.value = reason;
      eligibleMembers.value = progress.eligibleMembers;
    },
    // 終了後の「次へ」・Enter・OK は、結果の画面へ進む(エンディングへは結果の画面から進む)
    onLeave: () => void router.push(to("/jackpot-result")),
    onStarted: () => host.hold(),
    onSettled: publishHostState,
  });

  const handleKeyDown = (ev: KeyboardEvent) => {
    if (ev.key === "Enter") advance();
  };

  // 読み込み中に画面を離れた場合に、離れたあとでキー操作の受付や進行を始めないための印
  let disposed = false;

  /** 画面を開いたとき、演出が途中だった抽選があれば、同じ結果で演出し直す。 */
  let resumeSteps: Awaited<ReturnType<typeof resumeCycle>> | null = null;

  onMounted(async () => {
    try {
      await updatePrizes(await prizeRepo.getPrizes());
      members.value = await memberRepo.getMembers();
      // 抽選の状態(当選者・確変の予定)を保存先から読み直す。以後の読み出しはこのメモリから行う
      const store = drawService.store;
      rehearsal.value = store.kind === "rehearsal";
      await store.load();
      storeLoadedAtMs = Date.now();
      // 確変にする回は、管理画面の設定（本抽選画面設定）に従って、セッションで最初の抽選のときに決める
      const mainSettings = await container.resolve(ScreenSettingsService).fetchScreenSetting("main", "main-screen-settings");
      kakuhenPlan = parseKakuhenPlan(mainSettings);
      ctx.prizeStopSec = parsePrizeStopSec(mainSettings);
      await drawService.initializeStateIfNeeded(prizes.value, kakuhenPlan);
      // 確定済みで公開されていない抽選(再読み込み前に演出の途中だったもの)は、引き直さずに同じ結果で演出し直す
      const pending = await store.pending();
      if (pending) {
        try {
          resumeSteps = await resumeCycle(pending);
        } catch (e) {
          // 演出し直せないときは、次の抽選の前に公開して先へ進む(DrawApplicationService.executeDraw)
          console.error("[DrawOrchestrator] failed to resume the pending draw", e);
          alertError(e);
        }
      }
    } catch (e) {
      console.error("[DrawOrchestrator] failed to load draw data", e);
      alertError(e);
      return;
    }
    if (disposed) return;
    window.addEventListener("keydown", handleKeyDown);
    flow.ready = true;
    if (resumeSteps) queue.addCycle(resumeSteps);
    advance();
  });

  // 画面を離れたら、キー操作の受付を止め、進行を止め、鳴らしているルーレットの BGM を止め、
  // 景品の画像のURLを破棄する（離れたあとに BGM が鳴り続けたり、URLが残ったりしないように）。
  onUnmounted(() => {
    disposed = true;
    window.removeEventListener("keydown", handleKeyDown);
    flow.ready = false;
    cycleSource.invalidate();
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
    eligibleMembers,
    rehearsal,
    notice,
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
