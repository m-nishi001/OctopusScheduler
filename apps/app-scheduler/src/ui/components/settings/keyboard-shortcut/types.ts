// src/ui/components/settings/keyboard-shortcut/types.ts
export type TransitionPageFormData = {
  actionType: "TransitionPageEvent";
  transitionUrl: string;
};

export type PlayAudioFormData = {
  actionType: "PlayAudioEvent";
  audioId: string;
  // optional file only used in UI, not persisted
  audioFile?: File | null;
};

export type SlideshowFormData = {
  actionType: "SlideshowEvent";
  folderId: string;
  displayDuration: number;
};

export type ShowContentFormData = {
  actionType: "ShowContentEvent";
  contentType: "image" | "movie" | "html";
  contentId: string;
  htmlContent?: string;
};

// Edit variants include an eventId for persisted actions
export type EditTransitionPageFormData = TransitionPageFormData & {
  eventId: string;
};
export type EditPlayAudioFormData = PlayAudioFormData & { eventId: string };
export type EditSlideshowFormData = SlideshowFormData & { eventId: string };
export type EditShowContentFormData = ShowContentFormData & { eventId: string };

export type EventFormDataOrEdit =
  | TransitionPageFormData
  | PlayAudioFormData
  | SlideshowFormData
  | ShowContentFormData
  | EditTransitionPageFormData
  | EditPlayAudioFormData
  | EditSlideshowFormData
  | EditShowContentFormData;

export type EventFormData =
  | TransitionPageFormData
  | PlayAudioFormData
  | SlideshowFormData
  | ShowContentFormData;

export interface ShortcutFormData {
  keys: string[];
  actions: EventFormData[];
}

export function swap<T>(arr: T[], i: number, j: number): void {
  const tmp = arr[i];
  arr[i] = arr[j];
  arr[j] = tmp;
}
