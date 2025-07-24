import { injectable } from "tsyringe";
import { ApiResponse, GasService } from "../core/gas-service";

@injectable()
export class TimeScheduler implements GasService{

    serviceName: string = "time-scheduler";
    functions: Record<string, (...args: any) => ApiResponse<any>>;
    
    timeSchedules!: SchedulerEvent[];

    constructor() {
        this.functions = {};

        this.loadTimeSchedule();
    }

    loadTimeSchedule() {
        this.timeSchedules = [
            new SchedulerEvent("EventA"),
            new SchedulerEvent("EventB"),
            new SchedulerEvent("EventC"),
        ];
    }

    run() {
        let index = 0;
        const interval = setInterval(() => {
            console.log(this.timeSchedules[index++]);
            if (this.timeSchedules.length === index) clearInterval(interval);
        }, 5000);
    }
}