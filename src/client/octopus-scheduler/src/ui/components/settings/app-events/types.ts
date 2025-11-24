// Minimal shared types for app-event forms
export type AppEventFormProps = {
  id?: string;
  actionType?: string;
  [key: string]: any;
};

export type EventOption = {
  label: string;
  value: string;
};
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

// Form data aliases for backward compatibility with existing form imports
export type PlayAudioFormData = { actionType: "PlayAudioEvent" } & PlayAudioDto["data"];
export type EditPlayAudioFormData = PlayAudioFormData & { eventId: string };

export type ShowContentFormData = { actionType: "ShowContentEvent" } & ShowContentDto["data"];
export type EditShowContentFormData = ShowContentFormData & { eventId: string };

export type SlideshowFormData = { actionType: "SlideshowEvent" } & SlideshowDto["data"];
export type EditSlideshowFormData = SlideshowFormData & { eventId: string };

export type TransitionPageFormData = { actionType: "TransitionPageEvent" } & TransitionPageDto["data"];
export type EditTransitionPageFormData = TransitionPageFormData & { eventId: string };

