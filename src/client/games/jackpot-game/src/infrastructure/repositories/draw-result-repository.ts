import { injectable } from "tsyringe";
import type { LotteryResultDto } from "../../applications/draw/dto/lottery-result-dto";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class DrawResultRepository {
  private readonly service;
  constructor() {
    this.service = GasFunctionService.create("callJackpotGameApi")!;
  }

  async addDrawResult(result: LotteryResultDto): Promise<void> {
    return new Promise((resolve, reject) => {
      this.service
        .createCall<{ result: LotteryResultDto }>(
          "DrawResultService.addDrawResult",
          result
        )
        .withSuccessed(() => resolve())
        .withFailuered((message: string) =>
          reject(new Error(`Failed to add draw result: ${message}`))
        )
        .invoke();
    });
  }
}
