import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { ShowImageEvent } from "../../../domain/schedule-event/entity/events/show-image-event";
import { injectable } from "tsyringe";

@injectable()
export class ShowImageEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === ShowImageEvent.scheduleEventType;
    }
    create(obj: IScheduleEvent): IScheduleEvent | null {
        return ShowImageEvent.from(obj);
    }
}
