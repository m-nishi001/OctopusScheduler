import type { History } from '../../domains/history/history';
import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class HistoryRepository {
    private readonly service;
    constructor() {
        this.service = GasFunctionService.create("callJackpotGameApi")!;
    }

    async getHistory(): Promise<History[]> {
        return new Promise((resolve, reject) => {
            this.service
                .createCall<History[]>("DrawResultService.getResults")
                .withSuccessed(resolve)
                .withFailuered((message: string) => reject(new Error(`Failed to get history: ${message}`)))
                .invoke();
        });
    }
}
