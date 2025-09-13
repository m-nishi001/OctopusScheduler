import type { CreateScheduleEventDto } from './create-schedule-event-dto';
import { PlayAudioEventDetail } from './event-details/PlayAudioEventDetail';

export interface PlayAudioScheduleEventDto extends CreateScheduleEventDto {
  detail: PlayAudioEventDetail;
}
