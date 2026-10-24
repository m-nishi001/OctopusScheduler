import { injectable, inject } from "tsyringe";
import { PrizeReservationService } from "../../model/draw/prize-reservation-service";
import type { Prize } from "../../model/prize/prize";
import { AUTO_KAKUHEN_PLAN } from "../../model/draw/kakuhen-plan";
import type { KakuhenPlan } from "../../model/draw/kakuhen-plan";
import type { DrawPlan, DrawStore } from "./draw-store";

/** 抽選の準備。確変にする回を決め、その数だけ景品を取り置いて、抽選の保存先に確変の予定として残す。 */
@injectable()
export class DrawStateInitializer {
  constructor(
    @inject(PrizeReservationService)
    private prizeReservationService: PrizeReservationService
  ) {}

  /**
   * 確変の予定を `plan`(画面設定)に従って決め、保存先に残す。
   * すでに保存先にあるとき(抽選の途中・再開・同じセッションの2回目のイベント)は何もしない。
   * つまり、予定はセッションで最初の1回で確定する(リセットするまで変わらない)。
   */
  async initialize(store: DrawStore, prizes: Prize[], plan: KakuhenPlan = AUTO_KAKUHEN_PLAN): Promise<DrawPlan> {
    const existing = await store.plan();
    if (existing) return existing;

    const kakuhenTimings = this.prizeReservationService.calculateKakuhenTimings(prizes.length, plan);
    const reservedPrizeIds = this.prizeReservationService.reservePrizes(kakuhenTimings.length, prizes).map((p) => p.id);
    return store.ensurePlan(kakuhenTimings, reservedPrizeIds);
  }
}
