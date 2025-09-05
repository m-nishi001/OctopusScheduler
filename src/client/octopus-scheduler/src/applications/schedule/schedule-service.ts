import { Schedule } from "../../domains/schedule/entity/schedule";
import type { IEvent } from "../../domains/schedule/entity/event";
import type { IScheduleRepository } from "../../domains/schedule/repository/schedule-repository";
import { ScheduleRepository } from "../../infrastructures/schedule/schedule-repository";

export class ScheduleService {
    private readonly scheduleRepository: IScheduleRepository;

    constructor() {
        this.scheduleRepository = new ScheduleRepository();
    }

    /**
     * 新しいスケジュールを作成して保存する
     */
    public async createNewSchedule(): Promise<void> {
        const newSchedule = Schedule.createNew();
        await this.scheduleRepository.save(newSchedule);
    }

    /**
     * 特定のスケジュールにイベントを追加する
     * @param scheduleId スケジュールID
     * @param event イベントエンティティ
     */
    public async addEventToSchedule(scheduleId: string, event: IEvent): Promise<void> {
        const schedule = await this.scheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new Error("Schedule not found.");
        }
        schedule.addEvent(event);
        await this.scheduleRepository.save(schedule);
    }

    /**
     * 特定のスケジュールからイベントを削除する
     * @param scheduleId スケジュールID
     * @param eventId 削除するイベントのID
     */
    public async removeEventFromSchedule(scheduleId: string, eventId: string): Promise<void> {
        const schedule = await this.scheduleRepository.findById(scheduleId);
        if (!schedule) {
            throw new Error("Schedule not found.");
        }
        schedule.removeEvent(eventId);
        await this.scheduleRepository.save(schedule);
    }

    /**
     * 指定されたIDのスケジュールを取得する
     * @param scheduleId スケジュールID
     * @returns Scheduleエンティティまたはnull
     */
    public async getScheduleById(scheduleId: string): Promise<Schedule | null> {
        return await this.scheduleRepository.findById(scheduleId);
    }

    /**
     * すべてのスケジュールを取得する
     * @returns Scheduleエンティティの配列
     */
    public async getAllSchedules(): Promise<Schedule[]> {
        return await this.scheduleRepository.findAll();
    }

    /**
     * スケジュールを削除する
     * @param scheduleId 削除するスケジュールのID
     */
    public async deleteSchedule(scheduleId: string): Promise<void> {
        await this.scheduleRepository.delete(scheduleId);
    }
}