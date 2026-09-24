// Flat DTO shape matching what each event kind's `fromData()` constructor
// consumes today — this is the shape the UI settings forms already produce
// via their `save()` handlers. A nested `{ actionType, data: {...} }` variant
// also exists in the UI layer (`ui/pages/settings/app-events/types.ts`); the
// two are unified onto this flat shape as part of moving the app-events form
// UI into `ui/pages` (see the settings-UI migration step).
export interface PlayAudioEventDto {
  actionType: "PlayAudioEvent";
  id?: string;
  audioId: string;
  fadeOutDuration?: number;
}

export interface ShowContentEventDto {
  actionType: "ShowContentEvent";
  id?: string;
  contentType: "image" | "movie" | "html";
  contentId?: string;
  htmlString?: string;
  fadeOutDuration?: number;
  displayMode?: "fade" | "scroll-up" | "scroll-down";
  effect?: "fade" | "scroll" | "static";
  duration?: number;
  fadeInTime?: number;
  fadeOutTime?: number;
  scrollDirection?: "up" | "down" | "left" | "right";
}

export interface SlideshowEventDto {
  actionType: "SlideshowEvent";
  id?: string;
  folderId: string;
  displayDuration: number;
  transitionType?: "fade" | "slide";
  slideDirection?: "left" | "right" | "up" | "down";
  bgmIds?: string[];
}

export interface StopAudioEventDto {
  actionType: "StopAudioEvent";
  id?: string;
  audioId?: string;
  fadeOutDuration?: number;
}

export interface TransitionPageEventDto {
  actionType: "TransitionPageEvent";
  id?: string;
  transitionUrl: string;
  fadeOutDuration?: number;
}

export type AppEventDto =
  | PlayAudioEventDto
  | ShowContentEventDto
  | SlideshowEventDto
  | StopAudioEventDto
  | TransitionPageEventDto;
