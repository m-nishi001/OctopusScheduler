import { injectable, inject } from "tsyringe";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import type { DrawMemberRequest } from "./dto/draw-member-request";
import type { DrawMemberResponse } from "./dto/draw-member-response";
import type { DrawPrizeResponse } from "./dto/draw-prize-response";
import { isDrawablePrize, type Prize } from "../../model/prize/prize";
import type { PrizeCounts } from "../../model/draw/half-remaining";
import type { DrawResultDto } from "./dto/draw-result-dto";
import { toDrawProgress, type DrawProgress } from "./dto/draw-progress";
import type { Member } from "../../model/member/member";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";
import {
  DrawConflictError,
  NotFoundError,
  StateNotInitializedError,
  NoAvailablePrizesError,
  NoEligibleMembersError,
} from "../../model/errors";
import { DrawPoolProviderToken } from "../../model/draw/draw-pool";
import type { DrawPoolProvider } from "../../model/draw/draw-pool";
import { restorePlan } from "../../model/draw/unrevealed-draws";
import { DrawStateInitializer } from "./draw-state-initializer";
import type { KakuhenPlan } from "../../model/draw/kakuhen-plan";
import { mapToDrawResult } from "./mappers/draw-result-mapper";
import { MemberRepository } from "../../model/member/member-repository";
import { JackpotRepository } from "../../model/jackpot-repository";
import { DrawStoreProvider } from "./draw-store-provider";
import type { DrawPlan, DrawStore, DrawStoreSource } from "./draw-store";

/** 1回の抽選でリールに流す人数・景品数(当選者を含む)。 */
const DEFAULT_REQUEST = { memberRequestCount: 10, prizeRequestCount: 8 } as const;

export interface DrawOutcomeParts {
  result: DrawResultDto;
  prizeRes: DrawPrizeResponse;
  memberRes: DrawMemberResponse;
  /** 当選者を飛ばして引き直せる、ほかの候補の人数(分かるときだけ)。0 なら飛ばせない。 */
  spareMembers?: number;
  /** この抽選を確定した時点の、当選対象の景品の数(「あと半分」の判定に使う)。 */
  prizeCounts: PrizeCounts;
}

/** 1回の抽選で使う、取得済みの入力(抽選の対象の一覧とメンバー名簿)。1回の抽選の間は取り直さない(取得は通信になることがある)。 */
export interface DrawInputs {
  /** 抽選の対象にするメンバーID。null は絞り込みなし。 */
  eligibleIds: string[] | null;
  members: Member[];
}

/** {@link DrawApplicationService.drawNext} の結果。終了(抽選せず)か、抽選して確定したか。 */
export type DrawNextResult =
  | { kind: "finished"; progress: DrawProgress }
  | { kind: "drawn"; progress: DrawProgress; outcome: DrawOutcomeParts };

/**
 * 抽選の流れ(メンバー抽選・景品抽選・確変)をまとめるアプリケーション層。
 * 画面はここを呼ぶだけで、抽選の規則(重み・取り置き・確変)は下の層が、結果の保存は DrawStore が受け持つ。
 * 抽選状態(当選者・確変の予定)は DrawStore が正本で、ここでは持たない。
 */
@injectable()
export class DrawApplicationService {
  constructor(
    @inject(MemberRepository) private readonly memberRepo: MemberRepository,
    @inject(JackpotRepository) private readonly prizeRepo: JackpotRepository,
    @inject(DrawStoreProvider) private readonly stores: DrawStoreSource,
    @inject(MemberDrawService) private memberDrawService: MemberDrawService,
    @inject(PrizeDrawService) private prizeDrawService: PrizeDrawService,
    @inject(CryptoIdGenerator) private readonly idGenerator: CryptoIdGenerator,
    @inject(DrawStateInitializer)
    private drawStateInitializer: DrawStateInitializer,
    @inject(DrawPoolProviderToken) private readonly drawPool: DrawPoolProvider
  ) {}

  /** いまの抽選状態の置き場(セッションの結果ファイル、または、メモリだけのリハーサル)。 */
  get store(): DrawStore {
    return this.stores.current();
  }

  /** 抽選を始める準備(確変の予定の決定と景品の取り置き)。保存先に予定があれば何もしない。{@link DrawStateInitializer.initialize} */
  async initializeStateIfNeeded(prizes: Prize[], plan?: KakuhenPlan): Promise<DrawPlan> {
    return this.drawStateInitializer.initialize(this.store, prizes, plan);
  }

  async getRemainingPrizes(): Promise<Prize[]> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.store.results();
    return this.prizeDrawService.getRemainingPrizes(prizes, results);
  }

  /** 確定済みの抽選をすべて含めた、当選対象の景品の数。この抽選が最後に確定したもの(before = after + 1)として数える。 */
  private async prizeCountsAfterDraw(): Promise<PrizeCounts> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.store.results();
    const after = this.prizeDrawService.getRemainingPrizes(prizes, results).length;
    return { total: this.prizeDrawService.countDrawablePrizes(prizes), before: after + 1, after };
  }

  /**
   * 抽選の進み具合(残り景品・抽選の対象の残りメンバー・終了の理由)。
   * 終了の判定はここ1か所。景品が残っていても、対象のメンバーが全員当選していれば終了になる。
   * 対象の一覧を取得できないときは、終了と見なさず例外のまま上へ伝える(誤って終わらせない)。
   */
  async getDrawProgress(): Promise<DrawProgress> {
    return this.progressWith(await this.fetchInputs());
  }

  /** 抽選の対象の一覧とメンバー名簿を、並行して1回ずつ取得する。 */
  private async fetchInputs(): Promise<DrawInputs> {
    const [eligibleIds, members] = await Promise.all([this.drawPool.getEligibleMemberIds(), this.memberRepo.getMembers()]);
    return { eligibleIds, members };
  }

  /** 取得済みの入力での進み具合。保存先の読み出しはメモリからなので、通信はしない。 */
  private async progressWith({ eligibleIds, members: allMembers }: DrawInputs): Promise<DrawProgress> {
    const [prizes, results] = await Promise.all([this.prizeRepo.getPrizes(), this.store.results()]);
    const remainingPrizes = this.prizeDrawService.getRemainingPrizes(prizes, results).length;
    const eligible = eligibleIds === null ? null : new Set(eligibleIds);
    // 飛ばした(不在の)人は、もう抽選の対象ではない。当選済みの人と違い、「対象の N 名全員」の数にも入れない
    const excluded = new Set(await this.store.excludedMemberIds());
    const won = new Set(results.map((r) => r.wonMember?.id).filter(Boolean));
    const pool = allMembers.filter((m) => (eligible === null || eligible.has(m.id)) && !excluded.has(m.id));
    const remainingMembers = pool.filter((m) => !won.has(m.id)).length;
    return toDrawProgress(remainingPrizes, remainingMembers, results.length, pool.length);
  }

  /**
   * 続けられるか確かめ、続けられるなら抽選して確定する(本番の1サイクルぶんの下ごしらえ)。
   * 抽選の対象の一覧とメンバー名簿は1回だけ取得し、終了の判定と抽選で共有する(取得は通信になることがある)。
   * 終了なら抽選せずに `finished` を返す。
   */
  async drawNext(request: { memberRequestCount: number; prizeRequestCount: number } = DEFAULT_REQUEST): Promise<DrawNextResult> {
    const inputs = await this.fetchInputs();
    const progress = await this.progressWith(inputs);
    if (progress.endReason) return { kind: "finished", progress };
    const outcome = await this.executeDraw(request, inputs);
    // 進み具合は抽選の前のもの(今回の当選者もまだ候補に数えている)。当選者を飛ばしたときに引き直せるのは、ほかの候補
    return { kind: "drawn", progress, outcome: { ...outcome, spareMembers: Math.max(0, progress.remainingMembers - 1) } };
  }

  /**
   * 抽選を実行し、結果を保存先に確定(commit)する。演出は、この結果が返ってから始める
   * (確定できなかった結果で演出すると、画面と記録が食い違うため)。
   * 確定が矛盾で断られた(別の端末の操作・古い状態)ときは、状態を読み直して1回だけ引き直す。
   * 未公開の抽選(演出中のもの)は公開しない: 演出中に次の抽選を先読みで確定するため。公開は演出が済んだ呼び出し側が行う。
   * `inputs` を渡すと、対象の一覧・メンバー名簿を取り直さずにそれを使う(終了の判定で取得済みのとき。省略したら取得する)。
   */
  async executeDraw(
    request: { memberRequestCount: number; prizeRequestCount: number } = DEFAULT_REQUEST,
    inputs?: DrawInputs
  ): Promise<DrawOutcomeParts> {
    const store = this.store;
    for (let attempt = 0; ; attempt++) {
      const computed = await this.computeDrawResult(request, inputs);
      const result = mapToDrawResult(computed.prizeRes.drawId, computed.winnerMember, computed.winnerPrize, computed.prizeRes.isKakuhen ?? false);
      try {
        await store.commit(result);
        return { result, prizeRes: computed.prizeRes, memberRes: computed.memberRes, prizeCounts: await this.prizeCountsAfterDraw() };
      } catch (e) {
        if (!(e instanceof DrawConflictError) || attempt >= 1) throw e;
        // 読み直した状態(computeDrawResult が読む)で引き直す
      }
    }
  }

  /**
   * ホストを開いた(再読み込みした)ときの復元。未公開の抽選のうち古い分は公開済みにし(古い順)、最後の1件を返す(演出し直す)。無ければ null。
   * 規則は {@link restorePlan}。
   */
  async restoreUnrevealed(): Promise<DrawResultDto | null> {
    const store = this.store;
    const { revealFirst, resume } = restorePlan(await store.unrevealed());
    for (const draw of revealFirst) await store.reveal(draw.drawId);
    return resume;
  }

  /**
   * 確定済みで未公開の抽選(ホストの再読み込みなどで演出が途中だったもの)を、同じ当選者・景品で演出し直すための材料を作る。
   * 引き直さない。作り直すのは、リールに流すダミーだけ。
   */
  async resumeDraw(pending: DrawResultDto, request: { memberRequestCount: number; prizeRequestCount: number } = DEFAULT_REQUEST): Promise<DrawOutcomeParts> {
    const [members, prizes, results, plan] = await Promise.all([
      this.memberRepo.getMembers(),
      this.prizeRepo.getPrizes(),
      this.store.results(),
      this.store.plan(),
    ]);
    const winnerMember = members.find((m) => m.id === pending.wonMember?.id);
    if (!winnerMember) throw new NotFoundError(`当選したメンバー(${pending.wonMember?.name ?? pending.wonMember?.id ?? "不明"})がメンバー一覧に見つかりません`);
    const winnerPrize = prizes.find((p) => p.id === pending.wonPrize?.id);
    if (!winnerPrize) throw new NotFoundError(`当選した景品(${pending.wonPrize?.name ?? pending.wonPrize?.id ?? "不明"})が景品一覧に見つかりません`);

    const memberRes: DrawMemberResponse = {
      drawId: pending.drawId,
      winnerId: winnerMember.id,
      dummyIds: this.memberDrawService.pickDummyMemberIds(await this.dummyMemberPool(members), winnerMember.id, request.memberRequestCount - 1),
    };
    const prizeRes: DrawPrizeResponse = pending.isKakuhen
      ? this.kakuhenPresentation(prizes, results, plan?.reservedPrizeIds ?? [], winnerPrize.id, pending.drawId)
      : {
          drawId: pending.drawId,
          winnerPrizeId: winnerPrize.id,
          dummyWinnerPrizeId: null,
          dummyPrizeIds: this.prizeDrawService.pickDummyPrizeIds(prizes, winnerPrize.id, Math.max(0, request.prizeRequestCount - 1)),
          isKakuhen: false,
        };
    return {
      result: { ...pending, wonMember: toDtoMember(winnerMember), wonPrize: winnerPrize },
      prizeRes,
      memberRes,
      spareMembers: await this.spareMembers(),
      prizeCounts: await this.prizeCountsAfterDraw(),
    };
  }

  /** いまの当選者が飛ばされたときに引き直せる候補の人数。対象の一覧が取れないときは分からない(undefined)。 */
  private async spareMembers(): Promise<number | undefined> {
    try {
      return (await this.getDrawProgress()).remainingMembers;
    } catch {
      return undefined;
    }
  }

  /**
   * 不在の当選者を飛ばす。いまの当選者を以降の抽選から外し、同じ景品(確変の回もそのまま)の当選者だけを、残りの候補から引き直して確定する。
   * 引き直したメンバーのリールの内訳(memberRes)と、置き換え後の結果を返す。景品の演出はやり直さない。
   * 確定が矛盾で断られた(別の端末の操作・古い状態)ときは、状態を読み直して1回だけ引き直す。候補が残っていなければ NoEligibleMembersError。
   */
  async skipWinner(drawId: string, request: { memberRequestCount: number } = DEFAULT_REQUEST): Promise<{ result: DrawResultDto; memberRes: DrawMemberResponse; spareMembers: number }> {
    const store = this.store;
    for (let attempt = 0; ; attempt++) {
      const inputs = await this.fetchInputs();
      const current = (await store.results()).find((r) => r.drawId === drawId);
      if (!current) throw new DrawConflictError("飛ばす抽選結果が見つかりません");
      // 候補は、当選済み(いまの当選者を含む)と飛ばした人を除いた中から。いまの当選者は、まだこの抽選の結果に入っているので候補にならない
      const memberRes = await this.executeMemberDraw({ requestCount: request.memberRequestCount }, inputs, current.wonMember ? [current.wonMember.id] : []);
      if (!memberRes.winnerId) throw new NoEligibleMembersError("ほかに抽選できる人がいないため、当選者を飛ばせません。");
      const winner = inputs.members.find((m) => m.id === memberRes.winnerId);
      if (!winner) throw new NotFoundError("Winner member not found");
      try {
        await store.skipWinner(drawId, toDtoMember(winner));
      } catch (e) {
        if (!(e instanceof DrawConflictError) || attempt >= 1) throw e;
        continue;
      }
      const progress = await this.progressWith(inputs);
      return { result: { ...current, wonMember: toDtoMember(winner) }, memberRes: { ...memberRes, drawId }, spareMembers: progress.remainingMembers };
    }
  }

  /**
   * 本番と同じ抽選計算を行うが、結果を保存しない(確定しない)プレビュー用抽選。
   * 設定画面の動作確認など、本番の当選者・景品の在庫を消費せずに「実際の抽選と同じ見た目の結果」を確認したい用途に使う。
   */
  async previewDraw(request: { memberRequestCount: number; prizeRequestCount: number } = DEFAULT_REQUEST): Promise<Omit<DrawOutcomeParts, "prizeCounts">> {
    const computed = await this.computeDrawResult(request);
    const result = mapToDrawResult(computed.prizeRes.drawId, computed.winnerMember, computed.winnerPrize, computed.prizeRes.isKakuhen ?? false);
    return { result, prizeRes: computed.prizeRes, memberRes: computed.memberRes };
  }

  /**
   * メンバー抽選〜確変判定〜景品抽選までの計算を行う(保存はしない)。
   * `executeDraw`(確定する)と `previewDraw`(確定しない)の共通ロジック。
   */
  private async computeDrawResult(
    request: { memberRequestCount: number; prizeRequestCount: number },
    knownInputs?: DrawInputs
  ): Promise<{
    prizeRes: DrawPrizeResponse;
    memberRes: DrawMemberResponse;
    winnerMember: Member;
    winnerPrize: Prize;
  }> {
    const store = this.store;
    const inputs = knownInputs ?? (await this.fetchInputs());
    const memberRes = await this.executeMemberDraw({ requestCount: request.memberRequestCount }, inputs);
    if (!memberRes.winnerId) {
      throw new NotFoundError("No member winner");
    }
    const { members } = inputs;
    const winnerMember = members.find((m) => m.id === memberRes.winnerId);
    if (!winnerMember) throw new NotFoundError("Winner member not found");

    const prizes = await this.prizeRepo.getPrizes();
    const results = await store.results();
    const plan = await store.plan();
    if (!plan) throw new StateNotInitializedError("Prize draw state not initialized");
    const isKakuhen = this.prizeDrawService.isKakuhenTurn(results.length, plan.kakuhenTimings);

    const prizeRequest = { requestCount: request.prizeRequestCount };
    const prizeRes = isKakuhen
      ? this.executeKakuhenDraw(prizes, results, plan, prizeRequest, winnerMember)
      : this.executeNormalDraw(prizes, results, plan, prizeRequest, winnerMember);

    if (!prizeRes.winnerPrizeId) {
      throw new NoAvailablePrizesError("No prize available");
    }
    const winnerPrize = prizes.find((p) => p.id === prizeRes.winnerPrizeId)!;
    return { prizeRes, memberRes, winnerMember, winnerPrize };
  }

  /** 確変の景品抽選。取り置いた景品のうち、まだ当たっていないものから選ぶ。残っていなければ通常の抽選にする。 */
  private executeKakuhenDraw(
    prizes: Prize[],
    results: DrawResultDto[],
    plan: DrawPlan,
    request: { requestCount: number },
    member: Member
  ): DrawPrizeResponse {
    const unused = this.prizeDrawService.getUnusedReservedPrizes(prizes, results, plan.reservedPrizeIds);
    if (unused.length === 0) {
      console.warn("DrawApplicationService: No reserved prizes available for kakuhen; falling back to normal draw");
      return this.executeNormalDraw(prizes, results, plan, request, member, false);
    }
    const selected = this.prizeDrawService.selectRandomReserved(unused);
    return this.kakuhenPresentation(prizes, results, plan.reservedPrizeIds, selected.id, this.idGenerator.nextId());
  }

  /**
   * 確変の演出に使う内訳。ダミー当選は、実際に当たる景品とも他の取り置いた景品とも重ならないものから選ぶ。
   */
  private kakuhenPresentation(prizes: Prize[], results: DrawResultDto[], reservedPrizeIds: readonly string[], winnerPrizeId: string, drawId: string): DrawPrizeResponse {
    // 当選景品にダミーの指定があり、その景品が存在して当選景品自身でなければそれを使う。なければランダム
    const designatedId = prizes.find((p) => p.id === winnerPrizeId)?.kakuhenDummyPrizeId;
    const designated = designatedId && designatedId !== winnerPrizeId ? prizes.find((p) => p.id === designatedId) : undefined;
    // 当選対象でない景品(当たらない)は、ダミー当選にいつでも使える
    const drawableIds = new Set(this.prizeDrawService.getDrawablePrizes(prizes, results, reservedPrizeIds).map((p) => p.id));
    const dummyCandidates = prizes.filter((p) => p.id !== winnerPrizeId && (!isDrawablePrize(p) || drawableIds.has(p.id)));
    const dummyWinnerPrize =
      designated ??
      this.prizeDrawService.pickRandomPrizeFrom(dummyCandidates.length > 0 ? dummyCandidates : prizes.filter((p) => p.id !== winnerPrizeId));
    const dummyWinnerPrizeId = dummyWinnerPrize?.id || null;
    const excludedIds = new Set([winnerPrizeId, dummyWinnerPrizeId].filter(Boolean));
    return {
      drawId,
      winnerPrizeId,
      dummyWinnerPrizeId,
      dummyPrizeIds: this.prizeDrawService.buildDummyPrizeIds(prizes, excludedIds, 6),
      isKakuhen: true,
    };
  }

  /** 通常の景品抽選。通常枠(当選済みと取り置きを除く)から選ぶ。通常枠が尽きて取り置きが残っていれば、そこから引く。 */
  private executeNormalDraw(
    prizes: Prize[],
    results: DrawResultDto[],
    plan: DrawPlan,
    request: { requestCount: number },
    member: Member,
    allowReserved = true
  ): DrawPrizeResponse {
    const available = this.prizeDrawService.getDrawablePrizes(prizes, results, plan.reservedPrizeIds);
    if (available.length === 0) {
      // 通常枠(確変対応OFFの景品)が尽きたが取り置き(確変対応ON)が残っている(確変の回数が足りない場合など)ときは、
      // 取り置きから引く。詰まらせない。取り置きの景品は、サーバーの検査(取り置き = 確変の抽選)に合わせて確変の演出で見せる
      if (allowReserved && this.prizeDrawService.getUnusedReservedPrizes(prizes, results, plan.reservedPrizeIds).length > 0) {
        return this.executeKakuhenDraw(prizes, results, plan, request, member);
      }
      console.warn("No available prizes left");
      return { drawId: this.idGenerator.nextId(), winnerPrizeId: null, dummyWinnerPrizeId: null, dummyPrizeIds: [] };
    }
    const result = this.prizeDrawService.drawPrize({
      // 当選候補は引ける景品だけ。ダミー(見せ用)は全景品から選んで演出に変化を持たせる
      prizes,
      assignedPrizeIds: prizes.filter((p) => !available.some((a) => a.id === p.id)).map((p) => p.id),
      member,
      dummyCount: Math.max(0, request.requestCount - 1),
    });
    return {
      drawId: this.idGenerator.nextId(),
      winnerPrizeId: result?.winnerPrizeId || null,
      dummyWinnerPrizeId: null,
      dummyPrizeIds: result?.dummyPrizeIds || [],
      isKakuhen: false,
    };
  }

  /** `alsoExcluded`: 保存先にはまだ除外として載っていないが、この抽選では外す人(いま飛ばそうとしている当選者)。 */
  private async executeMemberDraw(request: DrawMemberRequest, { eligibleIds, members: allMembers }: DrawInputs, alsoExcluded: readonly string[] = []): Promise<DrawMemberResponse> {
    const results = await this.store.results();
    const excluded = [...(await this.store.excludedMemberIds()), ...alsoExcluded];

    // 抽選の対象を絞り込む（例: エントリーした人だけ）。候補も、リールに流すダミーも対象の中から選ぶ。
    // 一覧を取得できないときは例外のまま上へ伝える（全メンバーにフォールバックしない）。
    const members = this.restrictToPool(allMembers, eligibleIds, results, excluded);

    const res = this.memberDrawService.drawMember(members, results, request.requestCount - 1, excluded);
    return {
      drawId: this.idGenerator.nextId(),
      winnerId: res?.winnerId ?? null,
      dummyIds: res?.dummyIds ?? [],
    };
  }

  /** 演出し直すときのリールのダミー。対象の一覧が取れなければ(見せ用なので)全メンバーから選ぶ。 */
  private async dummyMemberPool(allMembers: Member[]): Promise<Member[]> {
    // 飛ばした人はリールに流さない(不在の人が、また回って見えないように)
    const excluded = await this.store.excludedMemberIds();
    const present = allMembers.filter((m) => !excluded.includes(m.id));
    try {
      const eligibleIds = await this.drawPool.getEligibleMemberIds();
      if (eligibleIds === null) return present;
      const eligible = new Set(eligibleIds);
      const pool = present.filter((m) => eligible.has(m.id));
      return pool.length > 0 ? pool : present;
    } catch {
      return present;
    }
  }

  /**
   * 抽選の対象（eligibleIds）に含まれるメンバーだけに絞る。null なら絞り込みなし。
   * 対象に、まだ当選していない人が1人もいなければ、人数の分かる理由の例外にする。
   */
  private restrictToPool(members: Member[], eligibleIds: string[] | null, results: DrawResultDto[], excludedMemberIds: readonly string[]): Member[] {
    if (eligibleIds === null) return members;
    const eligible = new Set(eligibleIds);
    const pool = members.filter((m) => eligible.has(m.id));
    const remaining = pool.filter((m) => !results.some((r) => r.wonMember?.id === m.id) && !excludedMemberIds.includes(m.id));
    if (remaining.length === 0) {
      throw new NoEligibleMembersError(
        pool.length === 0
          ? `抽選の対象のメンバーがいません(対象として届いた ${eligibleIds.length} 名のうち、メンバー名簿に載っているのは 0 名です)。エントリーした人がいないか、メンバー名簿に登録がありません。`
          : `抽選の対象のメンバー(${pool.length} 名)は、全員がすでに当選しているか、飛ばされています。`
      );
    }
    return pool;
  }
}

const toDtoMember = (m: Member) => ({ id: m.id, name: m.name, photo: m.photo, weight: m.weight });
