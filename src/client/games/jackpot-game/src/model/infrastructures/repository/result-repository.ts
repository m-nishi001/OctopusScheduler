import type { ResultResponse } from '../../applications/ResultResponse';
import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class ResultRepository {
  private readonly service;
  constructor() {
    this.service = GasFunctionService.create("callJackpotGameApi")!;
  }

  async getResult(drawId: string): Promise<ResultResponse> {
    return new Promise((resolve, reject) => {
      this.service
        .createCall<ResultResponse>("JackpotApiService.getResult", { drawId })
        .withSuccessed(resolve)
        .withFailuered((message: string) => reject(new Error(`Failed to get result: ${message}`)))
        .invoke();
    });
  }
}
