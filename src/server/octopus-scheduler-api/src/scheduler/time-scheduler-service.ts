import { injectable } from "tsyringe";
import { ApiResponse, GasService } from "../api/gas-service";

@injectable()
export class TimeScheduler implements GasService{

    serviceName: string = "time-scheduler";
    functions: Record<string, (...args: any) => ApiResponse<any>>;
    
    timeSchedules!: SchedulerEvent[];

    constructor() {
        this.functions = {};

        this.loadTimeSchedule();
    }
    invoke(...args: any[]): Promise<ApiResponse<any>> {
        throw new Error("Method not implemented.");
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