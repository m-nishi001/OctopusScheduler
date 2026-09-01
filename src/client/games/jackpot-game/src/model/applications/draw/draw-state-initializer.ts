import { injectable, inject } from "tsyringe";
import { PrizeReservationService } from "../../domains/draw/prize-reservation-service";
import { DrawResultService } from "./draw-result-service";
import { PrizeDrawStateRepository } from "../../infrastructures/draw/prize-draw-state-repository";
import type { Prize } from "../../domains/prize/prize";
import { mapToReservedDrawResult } from "./mappers/draw-result-mapper";
import { IdGeneratorToken } from "../../domains/common/id-generator";
import type { IdGenerator } from "../../domains/common/id-generator";

@injectable()
export class DrawStateInitializer {
  constructor(
    @inject(PrizeReservationService)
    private prizeReservationService: PrizeReservationService,
    @inject(DrawResultService) private drawResultService: DrawResultService,
    @inject(PrizeDrawStateRepository)
    private prizeDrawStateRepository: PrizeDrawStateRepository,
    @inject(IdGeneratorToken) private idGenerator: IdGenerator
  ) {}

  async initialize(prizes: Prize[]): Promise<void> {
    const state = await this.prizeDrawStateRepository.getState();
    if (state) return;

    const kakuhenTimings = this.prizeReservationService.calculateKakuhenTimings(
      prizes.length
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
