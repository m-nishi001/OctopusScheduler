import TransitionPageForm from "../app-events/forms/transition-page-form.vue";
import PlayAudioForm from "../app-events/forms/play-audio-form.vue";
import SlideshowForm from "../app-events/forms/slideshow-form.vue";
import ShowContentForm from "../app-events/forms/show-content-form.vue";

import { TransitionPageEvent } from "../../../../model/domains/app-event/transition/transition-page-event";
import { PlayAudioEvent } from "../../../../model/domains/app-event/play-audio/play-audio-event";
import { SlideshowEvent } from "../../../../model/domains/app-event/slideshow/slideshow-event";
import { ShowContentEvent } from "../../../../model/domains/app-event/show-content/show-content-event";

import type { IAppEvent } from "../../../../model/domains/app-event/app-event";

export interface UIActionEntry {
  label: string;
  component: any; // Vue component
  getInitial?: (action: any) => any;
  validate?: (data: any) => boolean;
  buildEvent: (id: string, now: Date, data: any) => IAppEvent;
}

const ACTION_REGISTRY: Record<string, UIActionEntry> = {
  TransitionPageEvent: {
    label: "画面遷移",
    component: TransitionPageForm,
    getInitial: (action: any) => ({ transitionUrl: action.transitionUrl }),
    validate: (data: any) => {
      if (!data.transitionUrl) {
        alert("URLを入力してください");
        return false;
      }
      return true;
    },
    buildEvent: (id: string, now: Date, data: any) =>
      TransitionPageEvent.fromParams({
        id,
        startTime: now,
        endTime: new Date(now.getTime() + 1000),
        transitionUrl: data.transitionUrl,
        fadeOutDuration: 0,
        processedAt: null,
        registeredAt: now,
        updatedAt: now,
      }),
  },
  PlayAudioEvent: {
    label: "音声再生",
    component: PlayAudioForm,
    getInitial: (action: any) => ({ audioId: action.audioId }),
    validate: (data: any) => {
      if (!data.audioId) {
        alert("音声IDを入力してください");
        return false;
      }
      return true;
    },
    buildEvent: (id: string, now: Date, data: any) =>
      PlayAudioEvent.fromParams({
        id,
        startTime: now,
        endTime: new Date(now.getTime() + 1000),
        audioId: data.audioId,
        fadeOutDuration: 0,
        processedAt: null,
        registeredAt: now,
        updatedAt: now,
      }),
  },
  SlideshowEvent: {
    label: "スライドショー",
    component: SlideshowForm,
    getInitial: (action: any) => ({
      folderId: action.folderId,
      displayDuration: action.displayDuration,
    }),
    validate: (data: any) => {
      if (!data.folderId || !data.displayDuration) {
        alert("フォルダIDと表示時間を入力してください");
        return false;
      }
      return true;
    },
    buildEvent: (id: string, now: Date, data: any) =>
      SlideshowEvent.fromParams({
        id,
        startTime: now,
        endTime: new Date(now.getTime() + 1000),
        folderId: data.folderId,
        displayDuration: data.displayDuration,
        transitionType: "fade",
        slideDirection: undefined,
        bgmIds: [],
        processedAt: null,
        registeredAt: now,
        updatedAt: now,
      }),
  },
  ShowContentEvent: {
    label: "コンテンツ表示",
    component: ShowContentForm,
    getInitial: (action: any) => ({
      contentType: action.contentType,
      contentId: action.contentId,
    }),
    validate: (data: any) => {
      if (!data.contentId) {
        alert("コンテンツIDを入力してください");
        return false;
      }
      return true;
    },
    buildEvent: (id: string, now: Date, data: any) =>
      ShowContentEvent.fromParams({
        id,
        startTime: now,
        endTime: new Date(now.getTime() + 1000),
        contentType: data.contentType as "image" | "movie" | "html",
        contentId: data.contentId,
        htmlString: undefined,
        displayMode: "fade",
        effect: "fade",
        duration: 10,
        fadeInTime: 1,
        fadeOutTime: 1,
        scrollDirection: undefined,
        processedAt: null,
        registeredAt: now,
        updatedAt: now,
      }),
  },
};

export function getUIActionRegistry(): Record<string, UIActionEntry> {
  return ACTION_REGISTRY;
}

export function registerUIAction(type: string, entry: UIActionEntry) {
  ACTION_REGISTRY[type] = entry;
}

export function getUIActionTypes(): string[] {
  return Object.keys(ACTION_REGISTRY);
}

export default ACTION_REGISTRY;
