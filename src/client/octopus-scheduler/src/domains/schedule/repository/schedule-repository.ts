import type { Schedule } from "../entity/schedule";

export interface IScheduleRepository {
    findById(id: string): Promise<Schedule | null>;
    findAll(): Promise<Schedule[]>;
    save(schedule: Schedule): Promise<void>;
    delete(id: string): Promise<void>;
    sync(): Promise<void>;
}