import { IScheduleEventFactory } from "./ischedule-event-factory";
import { IScheduleEvent } from "../../../domain/schedule-event/entity/schedule-event";
import { ShowImageEventType } from "../../../domain/schedule-event/value-object/event-types/events/show-image-event-type";
import { ShowImageEvent } from "../../../domain/schedule-event/entity/events/show-image-event";
import { IScheduleEventType } from "../../../domain/schedule-event/value-object/event-types/event-type";
import { injectable } from "tsyringe";

@injectable()
export class ShowImageEventFactory implements IScheduleEventFactory {
    supports(type: IScheduleEventType): boolean {
        return type.scheduleEventType === new ShowImageEventType().scheduleEventType;
    }
    createFromClient(obj: IScheduleEvent): IScheduleEvent | null {
        return ShowImageEvent.createByClient(obj);
    }
    createFromRepository(obj: IScheduleEvent): IScheduleEvent | null {
        return ShowImageEvent.from(obj);
    }
}
