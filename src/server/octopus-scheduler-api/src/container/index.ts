import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { ScheduleService } from "../application/schedule/schedule-service";
import { IScheduleEventRepository } from "../domain/schedule-event/schedule-event-reposiotry";
import { SpreadsheetScheduleEventRepository } from "../infrastructures/schedule/schedule-repository";
import { AssetService } from "../application/assets/asset-service";
import { IAssetRepository } from "../domain/assets/repository/asset-repository";
import { AssetRepository } from "../infrastructures/assets/asset-repository";
import { PlayAudioEventFactory } from "../application/schedule/factory/play-audio-event-factory";
import { PlayMovieEventFactory } from "../application/schedule/factory/play-movie-event-factory";
import { ShowImageEventFactory } from "../application/schedule/factory/show-image-event-factory";
import { TransitionPageEventFactory } from "../application/schedule/factory/transition-page-event-factory";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: ScheduleService });
        container.register<GasService>("IGasService", { useClass: AssetService });

        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: SpreadsheetScheduleEventRepository });
        container.register<IAssetRepository>("IAssetRepository", { useClass: AssetRepository });

        container.register("IScheduleEventFactory", { useClass: PlayAudioEventFactory });
        container.register("IScheduleEventFactory", { useClass: PlayMovieEventFactory });
        container.register("IScheduleEventFactory", { useClass: ShowImageEventFactory });
        container.register("IScheduleEventFactory", { useClass: TransitionPageEventFactory });
    }
}