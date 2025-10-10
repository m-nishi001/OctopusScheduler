import { injectable } from "tsyringe";
import type { DrawRequest } from "../../applications/draw/dto/draw-request";
import type { DrawResponse } from "../../applications/draw/dto/draw-response";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class DrawRepository {
  private readonly service;
  constructor() {
    this.service = GasFunctionService.create("callJackpotGameApi")!;
  }

  async executeDraw(request: DrawRequest): Promise<DrawResponse> {
    return new Promise((resolve, reject) => {
      this.service
        .createCall<DrawResponse>("LotteryService.draw", request)
        .withSuccessed(resolve)
        .withFailuered((message: string) =>
          reject(new Error(`Failed to execute draw: ${message}`))
        )
        .invoke();
    });
  }
}
