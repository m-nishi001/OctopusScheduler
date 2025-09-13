import type { CreateScheduleEventDto } from './create-schedule-event-dto';
import { PlayMovieEventDetail } from './event-details/PlayMovieEventDetail';

export interface PlayMovieScheduleEventDto extends CreateScheduleEventDto {
  detail: PlayMovieEventDetail;
}
