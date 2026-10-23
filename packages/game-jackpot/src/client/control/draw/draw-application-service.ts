import { injectable, inject } from "tsyringe";
import { MemberDrawService } from "../../model/draw/member-draw-service";
import { PrizeDrawService } from "../../model/draw/prize-draw-service";
import type { DrawMemberRequest } from "./dto/draw-member-request";
import type { DrawMemberResponse } from "./dto/draw-member-response";
import type { DrawPrizeResponse } from "./dto/draw-prize-response";
import type { Prize } from "../../model/prize/prize";
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
import { DrawStateInitializer } from "./draw-state-initializer";
import type { KakuhenPlan } from "../../model/draw/kakuhen-plan";
import { mapToDrawResult } from "./mappers/draw-result-mapper";
import { MemberRepository } from "../../model/member/member-repository";
import { PrizeRepository } from "../../model/prize/prize-repository";
import { DrawStoreProvider } from "./draw-store-provider";
import type { DrawPlan, DrawStore, DrawStoreSource } from "./draw-store";

/** 1回の抽選でリールに流す人数・景品数(当選者を含む)。 */
const DEFAULT_REQUEST = { memberRequestCount: 10, prizeRequestCount: 8 } as const;

export interface DrawOutcomeParts {
  result: DrawResultDto;
  prizeRes: DrawPrizeResponse;
  memberRes: DrawMemberResponse;
}

/**
 * 抽選の流れ(メンバー抽選・景品抽選・確変)をまとめるアプリケーション層。
 * 画面はここを呼ぶだけで、抽選の規則(重み・取り置き・確変)は下の層が、結果の保存は DrawStore が受け持つ。
 * 抽選状態(当選者・確変の予定)は DrawStore が正本で、ここでは持たない。
 */
@injectable()
export class DrawApplicationService {
  constructor(
    @inject(MemberRepository) private readonly memberRepo: MemberRepository,
    @inject(PrizeRepository) private readonly prizeRepo: PrizeRepository,
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

  /**
   * Return a simple summary of total prizes and remaining prizes.
   * Used by UI code to decide whether to show half/ending dialogs.
   */
  async getLastPrizeCount(): Promise<{ total: number; remaining: number }> {
    const prizes = await this.prizeRepo.getPrizes();
    const results = await this.store.results();
    const remaining = this.prizeDrawService.getRemainingPrizes(prizes, results).length;
    return { total: prizes.length, remaining };
  }

  /**
   * 抽選の進み具合(残り景品・抽選の対象の残りメンバー・終了の理由)。
   * 終了の判定はここ1か所。景品が残っていても、対象のメンバーが全員当選していれば終了になる。
   * 対象の一覧を取得できないときは、終了と見なさず例外のまま上へ伝える(誤って終わらせない)。
   */
  async getDrawProgress(): Promise<DrawProgress> {
    const [prizes, results, allMembers, eligibleIds] = await Promise.all([
      this.prizeRepo.getPrizes(),
      this.store.results(),
      this.memberRepo.getMembers(),
      this.drawPool.getEligibleMemberIds(),
    ]);
    const remainingPrizes = this.prizeDrawService.getRemainingPrizes(prizes, results).length;
    const eligible = eligibleIds === null ? null : new Set(eligibleIds);
    const won = new Set(results.map((r) => r.wonMember?.id).filter(Boolean));
    const pool = allMembers.filter((m) => eligible === null || eligible.has(m.id));
    const remainingMembers = pool.filter((m) => !won.has(m.id)).length;
    return toDrawProgress(remainingPrizes, remainingMembers, results.length, pool.length);
  }

  /**
   * 抽選を実行し、結果を保存先に確定(commit)する。演出は、この結果が返ってから始める
   * (確定できなかった結果で演出すると、画面と記録が食い違うため)。
   * 確定が矛盾で断られた(別の端末の操作・古い状態)ときは、状態を読み直して1回だけ引き直す。
   */
  async executeDraw(request: { memberRequestCount: number; prizeRequestCount: number } = DEFAULT_REQUEST): Promise<DrawOutcomeParts> {
    const store = this.store;
    await this.revealPending(store);
    for (let attempt = 0; ; attempt++) {
      const computed = await this.computeDrawResult(request);
      const result = mapToDrawResult(computed.prizeRes.drawId, computed.winnerMember, computed.winnerPrize, computed.prizeRes.isKakuhen ?? false);
      try {
        await store.commit(result);
        return { result, prizeRes: computed.prizeRes, memberRes: computed.memberRes };
      } catch (e) {
        if (!(e instanceof DrawConflictError) || attempt >= 1) throw e;
        await this.revealPending(store); // 読み直した結果、公開されていない行があれば、先に公開してから引き直す
      }
    }
  }

  /** 公開されていない確定済みの抽選があれば公開する(前回の公開が通信の失敗で漏れていた場合の後始末)。 */
  private async revealPending(store: DrawStore): Promise<void> {
    const pending = await store.pending();
    if (pending) await store.reveal(pending.drawId);
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
    return { result: { ...pending, wonMember: toDtoMember(winnerMember), wonPrize: winnerPrize }, prizeRes, memberRes };
  }

  /**
   * 本番と同じ抽選計算を行うが、結果を保存しない(確定しない)プレビュー用抽選。
   * 設定画面の動作確認など、本番の当選者・景品の在庫を消費せずに「実際の抽選と同じ見た目の結果」を確認したい用途に使う。
   */
  async previewDraw(request: { memberRequestCount: number; prizeRequestCount: number } = DEFAULT_REQUEST): Promise<DrawOutcomeParts> {
    const computed = await this.computeDrawResult(request);
    const result = mapToDrawResult(computed.prizeRes.drawId, computed.winnerMember, computed.winnerPrize, computed.prizeRes.isKakuhen ?? false);
    return { result, prizeRes: computed.prizeRes, memberRes: computed.memberRes };
  }

  /**
   * メンバー抽選〜確変判定〜景品抽選までの計算を行う(保存はしない)。
   * `executeDraw`(確定する)と `previewDraw`(確定しない)の共通ロジック。
   */
  private async computeDrawResult(request: { memberRequestCount: number; prizeRequestCount: number }): Promise<{
    prizeRes: DrawPrizeResponse;
    memberRes: DrawMemberResponse;
    winnerMember: Member;
    winnerPrize: Prize;
  }> {
    const store = this.store;
    const memberRes = await this.executeMemberDraw({ requestCount: request.memberRequestCount });
    if (!memberRes.winnerId) {
      throw new NotFoundError("No member winner");
    }
    const members = await this.memberRepo.getMembers();
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
    const dummyCandidates = this.prizeDrawService.getDrawablePrizes(prizes, results, reservedPrizeIds).filter((p) => p.id !== winnerPrizeId);
    const dummyWinnerPrize = this.prizeDrawService.pickRandomPrizeFrom(
      dummyCandidates.length > 0 ? dummyCandidates : prizes.filter((p) => p.id !== winnerPrizeId)
    );
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
      // 通常枠が尽きたが取り置きが残っている(景品の増減で回数がずれた場合など)ときは取り置きから引く
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

  private async executeMemberDraw(request: DrawMemberRequest): Promise<DrawMemberResponse> {
    const allMembers = await this.memberRepo.getMembers();
    const results = await this.store.results();

    // 抽選の対象を絞り込む（例: エントリーした人だけ）。候補も、リールに流すダミーも対象の中から選ぶ。
    // 一覧を取得できないときは例外のまま上へ伝える（全メンバーにフォールバックしない）。
    const eligibleIds = await this.drawPool.getEligibleMemberIds();
    const members = this.restrictToPool(allMembers, eligibleIds, results);

    const res = this.memberDrawService.drawMember(members, results, request.requestCount - 1);
    return {
      drawId: this.idGenerator.nextId(),
      winnerId: res?.winnerId ?? null,
      dummyIds: res?.dummyIds ?? [],
    };
  }

  /** 演出し直すときのリールのダミー。対象の一覧が取れなければ(見せ用なので)全メンバーから選ぶ。 */
  private async dummyMemberPool(allMembers: Member[]): Promise<Member[]> {
    try {
      const eligibleIds = await this.drawPool.getEligibleMemberIds();
      if (eligibleIds === null) return allMembers;
      const eligible = new Set(eligibleIds);
      const pool = allMembers.filter((m) => eligible.has(m.id));
      return pool.length > 0 ? pool : allMembers;
    } catch {
      return allMembers;
    }
  }

  /**
   * 抽選の対象（eligibleIds）に含まれるメンバーだけに絞る。null なら絞り込みなし。
   * 対象に、まだ当選していない人が1人もいなければ、人数の分かる理由の例外にする。
   */
  private restrictToPool(members: Member[], eligibleIds: string[] | null, results: DrawResultDto[]): Member[] {
    if (eligibleIds === null) return members;
    const eligible = new Set(eligibleIds);
    const pool = members.filter((m) => eligible.has(m.id));
    const remaining = pool.filter((m) => !results.some((r) => r.wonMember?.id === m.id));
    if (remaining.length === 0) {
      throw new NoEligibleMembersError(
        pool.length === 0
          ? `抽選の対象のメンバーがいません(対象として届いた ${eligibleIds.length} 名のうち、メンバー名簿に載っているのは 0 名です)。エントリーした人がいないか、メンバー名簿に登録がありません。`
          : `抽選の対象のメンバー(${pool.length} 名)は、全員がすでに当選しています。`
      );
    }
    return pool;
  }
}

const toDtoMember = (m: Member) => ({ id: m.id, name: m.name, photoAssetId: m.photoAssetId, rank: m.rank, weight: m.weight });
