import type { CreateScheduleEventDto } from './create-schedule-event-dto';
import { ShowImageEventDetail } from './event-details/ShowImageEventDetail';

export interface ShowImageScheduleEventDto extends CreateScheduleEventDto {
  detail: ShowImageEventDetail;
}
