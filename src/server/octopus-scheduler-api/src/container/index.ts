import { container } from "tsyringe";
import { GasService } from "../application/gas-service";
import { IScheduleEventRepository } from "../domain/scheduler/schedule-event-reposiotry";
import { ScheduleEventRepository } from "../repository/scheduler/schedule-event-repository";
import { ScheduleEventService } from "../application/schedule-event/schedule-event-service";
import { IAudioRepository } from "../domain/assets/audio/repository/audio-repository";
import { AudioRepository } from "../infrastructures/assets/audio/audio-repository";

export class Container {
    static regiser() {
        container.register<GasService>("IGasService", { useClass: ScheduleEventService });
        container.register<IScheduleEventRepository>("IScheduleEventRepository", { useClass: ScheduleEventRepository });
        container.register<IAudioRepository>("IAudioRepository", { useClass: AudioRepository });
    }
}