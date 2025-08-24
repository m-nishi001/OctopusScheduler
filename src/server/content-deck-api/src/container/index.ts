import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { DriveService } from "../application/drive/drive-service";
import { IScheduleEventRepository } from "../domain/scheduler/schedule-event-reposiotry";
import { ScheduleEventRepository } from "../repository/scheduler/schedule-event-repository";
import { ScheduleEventService } from "../application/schedule-event/schedule-event-service";
import { IRepository } from "../repository/repository";
import { SpreadsheetService } from "../infrastructure/google-spreadsheet/spreadsheet-servie";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: DriveService });
        container.register<GasService>("IGasService", { useClass: ScheduleEventService });
        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: ScheduleEventRepository });
        container.register<IRepository>("IRepository", { useClass: SpreadsheetService })
    }
}