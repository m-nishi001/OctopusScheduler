import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { ScheduleService } from "../application/schedule/schedule-service";
import { IScheduleEventRepository } from "../domain/schedule-event/schedule-event-reposiotry";
import { SpreadsheetScheduleEventRepository } from "../infrastructures/schedule/schedule-repository";
import { AssetService } from "../application/assets/asset-service";
import { IAssetRepository } from "../domain/assets/repository/asset-repository";
import { AssetRepository } from "../infrastructures/assets/asset-repository";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: ScheduleService });
        container.register<GasService>("IGasService", { useClass: AssetService });

        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: SpreadsheetScheduleEventRepository });
        container.register<IAssetRepository>("IAssetRepository", { useClass: AssetRepository });
    }
}