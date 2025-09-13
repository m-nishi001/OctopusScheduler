import type { CreateScheduleEventDto } from './create-schedule-event-dto';
import { TransitionPageEventDetail } from './event-details/TransitionPageEventDetail';

export interface TransitionPageScheduleEventDto extends CreateScheduleEventDto {
  detail: TransitionPageEventDetail;
}
