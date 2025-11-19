import type { IAppEvent } from "./app-event";
import { TransitionPageEvent } from "./transition/transition-page-event";
import { PlayAudioEvent } from "./play-audio/play-audio-event";
import { SlideshowEvent } from "./slideshow/slideshow-event";
import { ShowContentEvent } from "./show-content/show-content-event";

export type EventTypeKey =
  | "TransitionPageEvent"
  | "PlayAudioEvent"
  | "SlideshowEvent"
  | "ShowContentEvent";

export interface EventFactory {
  fromData: (data: Record<string, any>) => IAppEvent;
}

const registry: Map<string, EventFactory> = new Map();

// Register built-in event types
registry.set("TransitionPageEvent", { fromData: TransitionPageEvent.fromData });
registry.set("PlayAudioEvent", { fromData: PlayAudioEvent.fromData });
registry.set("SlideshowEvent", { fromData: SlideshowEvent.fromData });
registry.set("ShowContentEvent", { fromData: ShowContentEvent.fromData });

export function getEventFromData(
  type: string,
  data: Record<string, any>
): IAppEvent {
  const factory = registry.get(type);
  if (!factory) {
    throw new Error(`Unknown event type: ${type}`);
  }
  return factory.fromData({ id: data.id, ...data });
}

export function registerEventType(type: string, factory: EventFactory) {
  registry.set(type, factory);
}

export function getRegisteredTypes(): string[] {
  return Array.from(registry.keys());
}
