// Consolidated DTO types for app events (UI layer)
export type ActionType =
  | "TransitionPageEvent"
  | "PlayAudioEvent"
  | "SlideshowEvent"
  | "ShowContentEvent";

export interface IEventDtoBase {
  actionType: ActionType;
  eventId?: string;
}

export interface TransitionPageDto extends IEventDtoBase {
  actionType: "TransitionPageEvent";
  data: { transitionUrl: string };
}

export interface PlayAudioDto extends IEventDtoBase {
  actionType: "PlayAudioEvent";
  data: { audioId: string; audioFile?: File | null };
}

export interface SlideshowDto extends IEventDtoBase {
  actionType: "SlideshowEvent";
  data: { folderId: string; displayDuration: number };
}

export interface ShowContentDto extends IEventDtoBase {
  actionType: "ShowContentEvent";
  data: {
    contentType: "image" | "movie" | "html";
    contentId: string;
    htmlContent?: string;
  };
}

export type EventDto =
  | TransitionPageDto
  | PlayAudioDto
  | SlideshowDto
  | ShowContentDto;

export default {};
