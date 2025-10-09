import type { ResultResponse } from "../../applications/result/dto/result-response";
import { injectable } from "tsyringe";
import type { Result } from "../../domains/result/result";
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
        .createCall<{ drawId: string }>("DrawResultService.getById", { drawId })
        .withSuccessed((result: any) => {
          if (result) {
            resolve({ results: [result] });
          } else {
            resolve({ results: [] });
          }
        })
        .withFailuered((message: string) =>
          reject(new Error(`Failed to get result: ${message}`))
        )
        .invoke();
    });
  }
}

export interface GetResultsRequest {}
export interface GetResultsResponse {
  results: Result[];
}
