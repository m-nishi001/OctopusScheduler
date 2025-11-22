// src/ui/components/settings/keyboard-shortcut/types.ts
export type TransitionPageFormData = {
  actionType: 'TransitionPageEvent';
  transitionUrl: string;
};

export type PlayAudioFormData = {
  actionType: 'PlayAudioEvent';
  audioId: string;
  // optional file only used in UI, not persisted
  audioFile?: File | null;
};

export type SlideshowFormData = {
  actionType: 'SlideshowEvent';
  folderId: string;
  displayDuration: number;
};

export type ShowContentFormData = {
  actionType: 'ShowContentEvent';
  contentType: 'image' | 'movie' | 'html';
  contentId: string;
  htmlContent?: string;
};

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
