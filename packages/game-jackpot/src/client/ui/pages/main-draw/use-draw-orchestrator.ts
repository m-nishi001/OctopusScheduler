import { ref, onMounted, onUnmounted, shallowRef, markRaw } from "vue";
import type { Component } from "vue";
import { container } from "tsyringe";
import { useRouter } from "vue-router";
import { DrawApplicationService } from "@control/draw/draw-application-service";
import { JackpotRepository } from "@model/jackpot-repository";
import { MemberRepository } from "@model/member/member-repository";
import { ScreenSettingsService } from "@control/screen-config/screen-settings-service";
import { parseParticipantStop, DEFAULT_PARTICIPANT_STOP } from "@model/draw/participant-stop";
import { parseMemberStopSec, parsePrizeStopSec, DEFAULT_MEMBER_STOP_SEC, DEFAULT_PRIZE_STOP_SEC } from "@model/draw/stop-sec";
import { parseKakuhenPlan, AUTO_KAKUHEN_PLAN, type KakuhenPlan } from "@model/draw/kakuhen-plan";
import { parseDemoDrawSettings, DEFAULT_DEMO_DRAW } from "@model/screen-config/demo-draw-setting";
import { nextScreen, SCREEN_PATH } from "@model/screen-flow";
import { DrawConflictError, NoEligibleMembersError } from "@model/errors";
import type { MemberDto } from "@control/member/dto/member-dto";
import type { DrawResultDto } from "@control/draw/dto/draw-result-dto";
import type { DrawMemberResponse } from "@control/draw/dto/draw-member-response";
import type { DrawPrizeResponse } from "@control/draw/dto/draw-prize-response";
import type { PrizeCounts } from "@model/draw/half-remaining";
import type { DrawEndReason } from "@control/draw/dto/draw-progress";
import { RevealTracker } from "@model/jackpot-host-state";
import { nextPending } from "@model/draw/unrevealed-draws";
import { ENTRANTS_CHANGED_EVENT } from "@model/draw/entrants-changed";
import { useJackpotHost } from "../../composables/use-jackpot-host";
import { useJackpotSession } from "../../composables/use-jackpot-session";
import { useSound } from "@octopus/composables/use-sound";
import { useScreenSound } from "../../composables/use-screen-sound";
import { usePrizeDrawState } from "./prize-animation-state";
import SlotAnimation from "./slot/slot-animation.vue";
import RouletteAnimation from "./roulette/roulette-animation.vue";
import { ActionQueue } from "./action-queue";
import { revokePreparedPrizes } from "./roulette/roulette-prize-preparer";
import { createBgmBlobLoader } from "./bgm-blob-loader";
import type { DrawContext } from "./draw-context";
import { buildCycle, buildSkipCycle } from "./draw-cycle";
import { kakuhenFinalPrize } from "./kakuhen-session";
import { useLotteryBgm } from "./use-lottery-bgm";
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
  const prizeRepo = container.resolve(JackpotRepository);
  const memberRepo = container.resolve(MemberRepository);
  const drawService = container.resolve(DrawApplicationService);
  const { to, isDemoDraw } = useJackpotSession();
  const sound = useSound();
  const router = useRouter();
  /** デモ抽選(練習抽選)で回す回数。設定を読むまでは既定。 */
  let demoRounds = DEFAULT_DEMO_DRAW.rounds;
  /** デモ抽選で、ここまでに引いた回数。 */
  let demoDrawn = 0;
  /** 画面のバッジに出す、デモ抽選の何回目か・全部で何回か。 */
  const demoRound = ref(0);
  const demoRoundTotal = ref(DEFAULT_DEMO_DRAW.rounds);
  /** デモ抽選を始めるまで流す BGM。最初の進行操作で止める(抽選中は、メンバー抽選・景品の BGM に任せる)。 */
  const demoBgm = useScreenSound();
  /** 景品抽選BGM(開始から停止開始まで)。当選BGM(bgm.ts)と同じ `screen` チャンネルで鳴らす(同時には鳴らない)。 */
  const prizeLotteryBgm = useLotteryBgm("prizeLotteryBgms");

  const { prizes, selectedPrize, preparedPrizes, updatePrizes, preparePrizes, buildPrizeItems, installPreparedPrizes, updateSelectedPrize } =
    usePrizeDrawState(prizeRepo);

  const members = ref<MemberDto[]>([]);
  const phase = ref("idle");
  const latestResult = ref<DrawResultDto | null>(null);
  const currentPrizeRes = ref<DrawPrizeResponse | null>(null);
  const currentPrizeCounts = ref<PrizeCounts | null>(null);
  const currentMemberRes = ref<DrawMemberResponse | null>(null);
  /** メンバー抽選の演出コンポーネントの鍵。当選者を飛ばして引き直すとき、前の当選者の状態が残らないよう作り直す。 */
  const memberAnimKey = ref(0);
  /** いまの当選者を飛ばしたとき、引き直せるほかの候補の人数(分かるときだけ)。管理端末に公開する。 */
  const spareMembers = ref<number | undefined>(undefined);
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
    phase,
    result: latestResult,
    prizeRes: currentPrizeRes,
    prizeCounts: currentPrizeCounts,
    prizes,
    selectedPrize,
    setSelectedPrize: updateSelectedPrize,
    preparePrizes,
    loadBgmBlob: createBgmBlobLoader(prizeRepo),
    sound,
    memberAnim: memberAnimRef,
    prizeAnim: animationRef,
    showPrizeWinningDialog,
    showHalfRemainingDialog,
    kakuhenOverlayVisible,
    prizeLotteryBgm,
    memberStopSec: DEFAULT_MEMBER_STOP_SEC,
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
  const applyOutcome = ({ result, prizeRes, memberRes, winner, prizeItems, spareMembers: spare, prizeCounts }: DrawOutcome) => {
    installPreparedPrizes(prizeItems);
    spareMembers.value = spare;
    latestResult.value = result;
    currentPrizeRes.value = prizeRes;
    currentPrizeCounts.value = prizeCounts;
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
   * 確定できなかったとき(通信の失敗・矛盾)は例外。画面で演出中の抽選のほかに確定済みで未公開の抽選(先読み済み・確定はできたが応答が
   * 届かなかった)があれば、引き直さずそれを材料にする。
   */
  const prepareNextCycle = async (): Promise<NextCycleResult> => {
    // 結果が別の端末でリセットされた後などは確変の予定が無いので、引く前に決め直す(メモリから見るだけで通信しない)
    if (!(await drawService.store.plan())) await drawService.initializeStateIfNeeded(prizes.value, kakuhenPlan);
    // 演出中(latestResult)以外に、まだ画面に見せていない確定済みの抽選があれば、引き直さずにそれを演出する
    // (先読みで確定済みの次の抽選。当選者を飛ばしたあとも、演出中の抽選を次の抽選と取り違えない)
    const pending = nextPending(await drawService.store.unrevealed(), latestResult.value?.drawId);
    const next: NextCycleResult = pending ? { kind: "draw", outcome: await performResume(performDeps, pending) } : await performNext(performDeps);
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
   * 次のサイクルの材料の出どころ。そのサイクルを受け取った直後(演出中)に裏で先に用意し、進行操作で即座に渡す。
   * 用意できていなければ、従来どおりその場で(保存先を読み直して)用意する。
   */
  const cycleSource = new CycleSource<NextCycleResult>({
    refresh: () => refreshStore(),
    prepare: prepareNextCycle,
    discard: discardPrepared,
    onPrefetchError: (e) => console.warn("[DrawOrchestrator] next cycle prefetch failed; falling back to on-demand", e),
    onPrefetched: (prepared) => {
      // 次の抽選が確定したぶん、いまの当選者を飛ばして置き換えられる人が減る(その人数は、次の抽選の「飛ばして置き換えられる人数」と同じ)。進行中でなければ、管理端末に公開し直す
      if (prepared.kind !== "draw" || prepared.outcome.spareMembers === undefined) return;
      spareMembers.value = prepared.outcome.spareMembers;
      if (!disposed && !flow.busy) publishHostState();
    },
  });
  /** 先読みを作ったときの保存先(リハーサルとセッションの切り替えなどで別物になったら、先読みは使わない)。 */
  let prefetchedStore = drawService.store;

  /**
   * 次の抽選の材料がまだ無く待たされるとき、景品の画面のまま固まらないよう、メンバー抽選の待機画面を出す
   * (材料が届いたら、そのままメンバー抽選が始まる。次の当選者がまだ分からないので、メンバーはまだ見せない)。
   * 先読みが済んでいれば何もしない。最初の抽選(まだ景品の画面ではない)でも出さない。
   */
  const showMemberWaiting = () => {
    if (phase.value !== "prize") return;
    waitingFromPhase = phase.value;
    showPrizeWinningDialog.value = false;
    currentMemberRes.value = null;
    memberAnimKey.value++;
    phase.value = "member";
  };
  /** 待機画面を出す前の段階。出していなければ null。 */
  let waitingFromPhase: string | null = null;
  /** 次の抽選がなかった(終了)・失敗したときは、待機画面を出す前の段階に戻す(メンバー抽選が始まらないのに、メンバーの画面のままにしない)。 */
  const leaveMemberWaiting = () => {
    if (waitingFromPhase !== null) phase.value = waitingFromPhase;
    waitingFromPhase = null;
  };

  /** 次のサイクルを、画面の状態に反映して進行役に渡す。 */
  const nextCycle = async (): Promise<NextCycle> => {
    // デモ抽選は、決めた回数を引いたら次の画面(本抽選)へ進む
    if (isDemoDraw && demoDrawn >= demoRounds) return { kind: "leave" };
    await storeSync; // エントリーの取り消しで保存先を読み直している間は、先読みを受け取らない
    await revealOnStage(); // 演出中の抽選を先に公開する(公開は古い順。済んでいれば通信しない)
    revealTracker.reset(); // 新しい抽選が始まったので、前回の当選者を参加者への公開から外す
    if (prefetchedStore !== drawService.store) {
      cycleSource.invalidate();
      prefetchedStore = drawService.store;
    }
    const prefetched = cycleSource.state.kind !== "idle";
    let prepared = await cycleSource.next();
    // 先読みが「終了」だったとき、そのあとに対象が増えている(自動の対象で、途中から入室した人)かもしれないので、その場で確かめ直す
    if (prefetched && prepared.kind === "finished") {
      await refreshStore();
      prepared = await prepareNextCycle();
    }
    // 先読みの抽選が、エントリーの取り消しで保存先から削除されていたら捨てて、その場で用意する(稀なので待ちを許容)
    const preparedDrawId = prepared.kind === "draw" ? prepared.outcome.result.drawId : null;
    if (preparedDrawId && !(await drawService.store.results()).some((r) => r.drawId === preparedDrawId)) {
      discardPrepared(prepared);
      await refreshStore();
      prepared = await prepareNextCycle();
    }
    if (prepared.kind === "finished") {
      leaveMemberWaiting();
      return prepared;
    }
    waitingFromPhase = null;
    demoDrawn++;
    demoRound.value = demoDrawn;
    const steps = applyOutcome(prepared.outcome);
    startPrefetch(); // このサイクルを演出している間に、次の抽選を確定しておく(先読みは1段まで)
    return { kind: "cycle", steps };
  };

  /** 画面で演出中の抽選を公開する(次のサイクルを受け取る前に。公開できなければ例外で、次の進行操作でやり直す)。 */
  const revealOnStage = async () => {
    const onStage = latestResult.value;
    if (onStage && !(await revealDraw(onStage.drawId))) throw new Error("抽選の結果を保存できませんでした。通信状況を確認して、もう一度「次へ」を押してください");
  };

  /** 演出中の抽選のあとの抽選を、裏で用意し始める。デモ抽選で決めた回数を引き終えていたら(次は画面を離れる)しない。 */
  const startPrefetch = () => {
    const onStage = latestResult.value;
    if (disposed || !onStage || (isDemoDraw && demoDrawn >= demoRounds)) return;
    cycleSource.prefetch(onStage.drawId);
  };

  /**
   * エントリーが取り消された(同じ端末のイベント側からの合図)。先読みで確定した抽選が、サーバーで削除されていることがある。
   * 先読みを捨てて保存先を読み直し、作り直す(その間の進行操作は、読み直しを待つ)。
   */
  let storeSync: Promise<void> | null = null;
  const onEntrantsChanged = () => {
    if (drawService.store.kind !== "session" || disposed) return;
    cycleSource.invalidate();
    const sync = (async () => {
      try {
        await drawService.store.load();
        storeLoadedAtMs = Date.now();
      } catch (e) {
        console.warn("[DrawOrchestrator] reload after entrant change failed", e);
      }
      startPrefetch();
    })().finally(() => {
      if (storeSync === sync) storeSync = null;
    });
    storeSync = sync;
  };

  /** 確定済みで未公開の抽選を、引き直さずに同じ結果で演出し直すステップを返す(ホストの再読み込み後)。 */
  const resumeCycle = async (pending: DrawResultDto) => {
    revealTracker.reset();
    const outcome = await performResume(performDeps, pending);
    await preloadMemberImages(outcome.memberRes);
    return applyOutcome(outcome);
  };

  /**
   * 管理端末の「この人を飛ばす(不在)」。いまの当選者を以降の抽選から外し、同じ景品の当選者だけを引き直して、メンバー抽選からやり直す。
   * 景品と確変の回はそのまま(景品は演出し直さず、結果の表示だけ)。当選者が画面に見えていない間・古い画面の操作・進行中は何もしない。
   */
  const skipWinner = (memberId: string | null) => {
    void flow.replaceCycle(async () => {
      const current = latestResult.value;
      if (!current?.wonMember || !revealTracker.memberRevealed || (memberId !== null && memberId !== current.wonMember.id)) return null;
      try {
        // 通信中の公開と、裏で進んでいる次の抽選の確定が済むのを待ってから、先読みを捨てる
        // (確定済みの次の抽選は未公開で保存先に残り、あとで引き直さずに演出される)
        await publishHostState.settled();
        await cycleSource.settled();
        cycleSource.invalidate();
        const skipped = await drawService.skipWinner(current.drawId);
        await preloadMemberImages(skipped.memberRes);
        const prize = prizes.value.find((p) => p.id === skipped.result.wonPrize?.id);
        if (!prize) throw new Error("当選した景品が景品一覧に見つかりません");
        // 元のサイクルに残数の確認が残っていた(当選ダイアログの途中)ときだけ、組み直したサイクルにも残す
        const withRemaining = !queue.isEmpty();
        revealTracker.reset();
        showPrizeWinningDialog.value = false;
        showHalfRemainingDialog.value = false;
        kakuhenOverlayVisible.value = false;
        void sound.screen.stop();
        void prizeLotteryBgm.stop();
        latestResult.value = { ...skipped.result, wonPrize: prize };
        startPrefetch(); // 先読みで確定済みの次の抽選は捨てずに拾い直す(prepareNextCycle)
        currentMemberRes.value = skipped.memberRes;
        spareMembers.value = skipped.spareMembers;
        updateSelectedPrize(skipped.result.isKakuhen ? kakuhenFinalPrize(prize) : prize);
        memberAnimKey.value++;
        return buildSkipCycle(ctx, withRemaining);
      } catch (e) {
        console.error("[DrawOrchestrator] skip winner failed", e);
        cycleSource.invalidate();
        void drawService.store.load().catch((err) => console.error("[DrawOrchestrator] reload failed", err));
        if (e instanceof NoEligibleMembersError) {
          // ほかに候補がいない(先読みで次の抽選が確定したぶん減った)。画面はそのまま、知らせだけ出す
          notice.value = e.message;
          setTimeout(() => (notice.value = null), 8000);
        } else {
          alertError(e);
        }
        return null;
      }
    });
  };

  const onDrawError = (e: unknown) => {
    console.error("[DrawOrchestrator] draw failed", e);
    leaveMemberWaiting();
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
  /** 本抽選画面設定「参加者が景品ルーレットを止めることができる」。設定を読み込むまでは既定(止められる)。 */
  let participantStop = DEFAULT_PARTICIPANT_STOP;
  let flow: DrawFlowController;
  const advance = () => void flow.advance();
  const host = useJackpotHost({ advance, stopRoulette: advance, skipWinner }, { participantStop: () => participantStop });
  const publishHostState = createHostPublisher({
    host,
    tracker: revealTracker,
    reveal: revealDraw,
    demoDraw: isDemoDraw,
    phase: () => phase.value,
    ended: () => endReason.value !== null,
    nextLabel: () => queue.peekLabel(),
    result: () => latestResult.value,
    spare: () => spareMembers.value,
  });

  /** 画面の流れ(nextScreen)に従って、次の画面へ進む。 */
  const leaveToNext = () => {
    const next = nextScreen(isDemoDraw ? "demo-draw" : "draw", { demoDraw: true, entry: false });
    if (next) void router.push(to(SCREEN_PATH[next]));
  };

  flow = new DrawFlowController({
    queue,
    nextCycle,
    nextReady: () => cycleSource.state.kind === "ready" || (isDemoDraw && demoDrawn >= demoRounds),
    onWaiting: showMemberWaiting,
    onDrawError,
    onStepError: (e) => console.error("[DrawOrchestrator] step failed", e),
    onFinished: (reason, progress) => {
      // デモ抽選は、景品・メンバーが尽きても終了の画面を出さず、次の画面へ進む
      if (isDemoDraw) return leaveToNext();
      endReason.value = reason;
      eligibleMembers.value = progress.eligibleMembers;
    },
    // 終了後の「次へ」・Enter・OK は、次の画面へ進む(本抽選は結果の画面。エンディングへは結果の画面から進む。デモ抽選は本抽選)
    onLeave: () => leaveToNext(),
    onStarted: () => {
      void demoBgm.stop();
      host.hold();
    },
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
      // 全メンバーの写真を裏で読み始める(待たない)。次のサイクルの準備で、写真の読み込みを待たないようにする。失敗しても飾りなので画面は止めない
      void container.resolve(MemberPhotoCache).ensure(members.value.map((m) => m.photo));
      // 抽選の状態(当選者・確変の予定)を保存先から読み直す。以後の読み出しはこのメモリから行う
      const store = drawService.store;
      rehearsal.value = store.kind === "rehearsal";
      await store.load();
      // デモ抽選は、開くたびに空の状態から始める(前回の練習の当選者が、今回の練習から外れないように)
      if (isDemoDraw) await store.reset();
      storeLoadedAtMs = Date.now();
      // 確変にする回は、管理画面の設定（本抽選画面設定）に従って、セッションで最初の抽選のときに決める
      const mainSettings = await container.resolve(ScreenSettingsService).fetchScreenSetting("main", "main-screen-settings");
      kakuhenPlan = parseKakuhenPlan(mainSettings);
      ctx.memberStopSec = parseMemberStopSec(mainSettings);
      ctx.prizeStopSec = parsePrizeStopSec(mainSettings);
      participantStop = parseParticipantStop(mainSettings);
      if (isDemoDraw) {
        const demo = parseDemoDrawSettings(await container.resolve(ScreenSettingsService).fetchScreenSetting("demo", "demo-screen-settings"));
        demoRounds = demo.rounds;
        demoRoundTotal.value = demo.rounds;
        await demoBgm.play(demo.bgm); // 読み込んで鳴らし始めるまで待つ(以前と同じ。抽選が始まって止めるのは、そのあと)
      }
      await drawService.initializeStateIfNeeded(prizes.value, kakuhenPlan);
      // 確定済みで公開されていない抽選(再読み込み前に演出の途中だったもの)は、古い分を公開済みにして、最後の1件だけ引き直さずに同じ結果で演出し直す
      const pending = await drawService.restoreUnrevealed();
      if (pending) {
        try {
          resumeSteps = await resumeCycle(pending);
        } catch (e) {
          // 演出し直せないときは、公開して先へ進む(次の抽選は引き直す)
          console.error("[DrawOrchestrator] failed to resume the pending draw", e);
          alertError(e);
          await store.reveal(pending.drawId).catch((err) => console.error("[DrawOrchestrator] reveal failed", err));
        }
      }
    } catch (e) {
      console.error("[DrawOrchestrator] failed to load draw data", e);
      alertError(e);
      return;
    }
    if (disposed) return;
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener(ENTRANTS_CHANGED_EVENT, onEntrantsChanged);
    flow.ready = true;
    if (resumeSteps) {
      queue.addCycle(resumeSteps);
      startPrefetch();
    }
    advance();
  });

  // 画面を離れたら、キー操作の受付を止め、進行を止め、鳴らしているルーレットの BGM を止め、
  // 景品の画像のURLを破棄する（離れたあとに BGM が鳴り続けたり、URLが残ったりしないように）。
  onUnmounted(() => {
    disposed = true;
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener(ENTRANTS_CHANGED_EVENT, onEntrantsChanged);
    flow.ready = false;
    cycleSource.invalidate();
    void sound.screen.stop();
    void prizeLotteryBgm.stop();
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
    isDemoDraw,
    demoRound,
    demoRoundTotal,
    notice,
    advance,
    kakuhenOverlayVisible,
    currentMemberRes,
    memberAnimKey,
  } as const;
}

function alertError(e: unknown) {
  try {
    window.alert((e as Error)?.message || String(e));
  } catch {
    /* noop */
  }
}
