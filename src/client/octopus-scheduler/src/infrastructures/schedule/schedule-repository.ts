import { GasFunctionService } from "/root/google_apps_script/octopus-scheduler/src/client/packages/common-lib/src/google-apps-script/gas-script-service.ts";
import { ScheduleMapper } from "./schedule-mapper";
import type { IScheduleRepository } from "../../domains/schedule/repository/schedule-repository";
import { Schedule } from "../../domains/schedule/entity/schedule";

/**
 * ScheduleエンティティをGAS経由で永続化するためのリポジトリ
 */
export class ScheduleRepository implements IScheduleRepository {
    private readonly service;

    constructor() {
        const apiName = "callOctopusSchedulerApi";
        const service = GasFunctionService.create(apiName);
        if (!service) {
            throw new Error(`Failed to create GasFunctionService for API: ${apiName}`);
        }
        this.service = service;
    }

    /**
     * スケジュールIDに基づいてスケジュールを取得する
     * ローカルストレージを最初に検索し、なければリモートと同期して再取得
     */
    public async findById(id: string): Promise<Schedule | null> {
        let json: any = null;
        await this.service.createCall<any>("ScheduleService.findById", id)
            .withSuccessed(data => { json = data; })
            .withFailuered(message => { console.error("Failed to fetch schedule from server:", message); })
            .invoke();
        return json ? ScheduleMapper.toDomain(json) : null;
    }

    /**
     * すべてのスケジュールを取得する
     * ローカルストレージを最初に検索し、なければリモートと同期して再取得
     */
    public async findAll(): Promise<Schedule[]> {
        let jsonArray: any[] = [];
        await this.service.createCall<any[]>("ScheduleService.getAllScheduleEvents")
            .withSuccessed(data => { jsonArray = data; })
            .withFailuered(message => { console.error("Failed to fetch schedules from server:", message); })
            .invoke();
        console.log(`[ScheduleRepository] Fetched schedules data:`, jsonArray);
        return jsonArray.map(item => {
            console.log(`[ScheduleRepository] Fetched schedule data:`, JSON.stringify(item));
            return ScheduleMapper.toDomain(item);
        });
    }

    /**
     * スケジュールを保存または更新する
     */
    public async save(schedule: Schedule): Promise<void> {
        try {
            const json = ScheduleMapper.toJSON(schedule);
            await this.service.createCall<string>("ScheduleService.save", json)
                .withSuccessed(() => {
                    console.log("Schedule saved successfully to remote.");
                })
                .withFailuered((message: string) => {
                    throw new Error(`Failed to save schedule to remote: ${message}`);
                })
                .invoke();
        } catch (error) {
            console.error(`Failed to save schedule:`, error);
            throw new Error("Failed to save schedule.");
        }
    }

    /**
     * スケジュールを削除する
     */
    public async delete(id: string): Promise<void> {
        try {
            await this.service.createCall<string>("ScheduleService.delete", id)
                .withSuccessed(() => {
                    console.log("Schedule deleted successfully from remote.");
                })
                .withFailuered((message: string) => {
                    throw new Error(`Failed to delete schedule from remote: ${message}`);
                })
                .invoke();
        } catch (error) {
            console.error(`Failed to delete schedule:`, error);
            throw new Error("Failed to delete schedule.");
        }
    }
}