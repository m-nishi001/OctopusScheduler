import type { IAppEvent } from "./app-event";
import { TransitionPageEvent } from "./transition/transition-page-event";
import { PlayAudioEvent } from "./play-audio/play-audio-event";
import { SlideshowEvent } from "./slideshow/slideshow-event";
import { ShowContentEvent } from "./show-content/show-content-event";
import { getConverterForType } from "../../../core/event-converter/registry";

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
  // prefer converter-based revive
  const conv = getConverterForType(type);
  const raw = { id: data.id, type, ...data } as unknown as IAppEvent;
  if (conv && conv.revive) {
    return conv.revive(raw);
  }

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
