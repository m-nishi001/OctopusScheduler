import { injectable, inject } from "tsyringe";
import { PrizeReservationService } from "../../model/draw/prize-reservation-service";
import { DrawResultService } from "./draw-result-service";
import { PrizeDrawStateRepository } from "../../model/draw/prize-draw-state-repository";
import type { Prize } from "../../model/prize/prize";
import { AUTO_KAKUHEN_PLAN } from "../../model/draw/kakuhen-plan";
import type { KakuhenPlan } from "../../model/draw/kakuhen-plan";
import { mapToReservedDrawResult } from "./mappers/draw-result-mapper";
import { CryptoIdGenerator } from "../../model/common/crypto-id-generator";

@injectable()
export class DrawStateInitializer {
  constructor(
    @inject(PrizeReservationService)
    private prizeReservationService: PrizeReservationService,
    @inject(DrawResultService) private drawResultService: DrawResultService,
    @inject(PrizeDrawStateRepository)
    private prizeDrawStateRepository: PrizeDrawStateRepository,
    @inject(CryptoIdGenerator) private readonly idGenerator: CryptoIdGenerator
  ) {}

  /**
   * 本番の抽選を始める準備。確変にする回を `plan` に従って決めて保存し、その数だけ景品を予約する。
   * すでに決まっているとき（抽選の途中・再開）は何もしない。つまり、計画は最初の1回で確定する。
   */
  async initialize(prizes: Prize[], plan: KakuhenPlan = AUTO_KAKUHEN_PLAN): Promise<void> {
    const state = await this.prizeDrawStateRepository.getState();
    if (state) return;

    const kakuhenTimings = this.prizeReservationService.calculateKakuhenTimings(
      prizes.length,
      plan
    );
    await this.prizeDrawStateRepository.saveState(kakuhenTimings);
    const reservedPrizes = this.prizeReservationService.reservePrizes(
      kakuhenTimings.length,
      prizes
    );
    for (const prize of reservedPrizes) {
      const dto = mapToReservedDrawResult(this.idGenerator.nextId(), prize);
      console.log("[DrawStateInitializer] reserved dto:", dto);
      await this.drawResultService.addDrawResult(dto);
    }
  }
}
