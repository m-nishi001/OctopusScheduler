import TransitionPageForm from "../app-events/forms/transition-page-form.vue";
import PlayAudioForm from "../app-events/forms/play-audio-form.vue";
import SlideshowForm from "../app-events/forms/slideshow-form.vue";
import ShowContentForm from "../app-events/forms/show-content-form.vue";

// Domain event classes/types are intentionally not referenced here (UI-only registry).

export interface UIActionEntry {
  label: string;
  component: any; // Vue component
  // default data for the editor form (UI-only). Function accepts optional action to map existing entities.
  defaultData?: (action?: any) => any;
}

const ACTION_REGISTRY: Record<string, UIActionEntry> = {
  TransitionPageEvent: {
    label: "画面遷移",
    component: TransitionPageForm,
    defaultData: (action: any) => ({ transitionUrl: action?.transitionUrl }),
  },
  PlayAudioEvent: {
    label: "音声再生",
    component: PlayAudioForm,
    defaultData: (action: any) => ({ audioId: action?.audioId }),
  },
  SlideshowEvent: {
    label: "スライドショー",
    component: SlideshowForm,
    defaultData: (action: any) => ({
      folderId: action?.folderId,
      displayDuration: action?.displayDuration,
    }),
  },
  ShowContentEvent: {
    label: "コンテンツ表示",
    component: ShowContentForm,
    defaultData: (action: any) => ({
      contentType: action?.contentType,
      contentId: action?.contentId,
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
