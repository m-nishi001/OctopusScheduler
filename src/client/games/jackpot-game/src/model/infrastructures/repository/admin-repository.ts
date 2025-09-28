import { injectable } from "tsyringe";
import { GasFunctionService } from "../../../../../../packages/common-lib/src/google-apps-script/gas-script-service";

@injectable()
export class AdminRepository {
    private readonly service;
    constructor() {
        this.service = GasFunctionService.create("callJackpotGameApi")!;
    }

    async updateSettings(settings: object): Promise<void> {
        await this.service
            .createCall<void>("ScreenConfigService.update", settings)
            .withSuccessed(() => console.log("Settings updated"))
            .withFailuered(message => { throw new Error(`Failed to update settings: ${message}`); })
            .invoke();
    }
}
