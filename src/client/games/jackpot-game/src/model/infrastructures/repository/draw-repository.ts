import type { DrawRequest } from '../../applications/DrawRequest';
import type { DrawResponse } from '../../applications/DrawResponse';
import { injectable } from "tsyringe";
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
        .createCall<DrawResponse>("JackpotApiService.draw", request)
        .withSuccessed(resolve)
        .withFailuered((message: string) => reject(new Error(`Failed to execute draw: ${message}`)))
        .invoke();
    });
  }
}
