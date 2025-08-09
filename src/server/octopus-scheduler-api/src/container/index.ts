import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { TestService } from "../application/test-service";
import { DriveService } from "../application/drive/drive-service";
import { IScheduleEventRepository } from "../domain/scheduler/schedule-event-reposiotry";
import { ScheduleEventRepository } from "../repository/scheduler/schedule-event-repository";
import { ScheduleEventService } from "../application/schedule-event/schedule-event-service";
import { IRepository } from "../repository/repository";

// SharedPackages
import { SpreadsheetService } from "/root/google_apps_script/octopus-scheduler/src/server/shared-packages/src/google-spreadsheet-servie";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: TestService });
        container.register<GasService>("IGasService", { useClass: DriveService });
        container.register<GasService>("IGasService", { useClass: ScheduleEventService });
        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: ScheduleEventRepository });
        container.register<IRepository>("IRepository", { useClass: SpreadsheetService })
    }
}