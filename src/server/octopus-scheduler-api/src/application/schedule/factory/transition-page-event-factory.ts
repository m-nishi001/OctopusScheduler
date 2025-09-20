import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { TransitionPageEvent } from "../../../domain/schedule-event/entity/events/transition-page-event";
import { injectable } from "tsyringe";

@injectable()
export class TransitionPageEventFactory implements IScheduleEventFactory {
    supports(type: string): boolean {
        return type === TransitionPageEvent.scheduleEventType;
    }
    create(obj: IScheduleEvent): IScheduleEvent | null {
        return TransitionPageEvent.from(obj);
    }
}
