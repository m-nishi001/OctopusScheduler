import { container } from "tsyringe";
import { eventBus } from "../../../core/event-bus";
import { AppEventService } from "../../../model/applications/app-event/app-event-service";

/**
 * Send shortcut eventIds to the execute tab via BroadcastChannel.
 * Tries to preserve the same semantics as the keyboard listener: if
 * manualContentVisible is true and none of the events are ShowContentEvent,
 * emit hideContent on the local eventBus before posting messages.
 */
export async function sendShortcutViaChannel(
  eventIds: string[] | undefined,
  options?: { manualContentVisible?: boolean }
) {
  const ids: string[] = Array.isArray(eventIds) ? eventIds.slice() : [];
  const channel = new BroadcastChannel("octopus-control");
  try {
    // determine if any referenced event is a ShowContentEvent
    let containsShow = false;
    try {
      const appEventService = container.resolve(AppEventService) as any;
      for (const eid of ids) {
        try {
          const ev = await appEventService.getEventById(eid);
          if (ev && (ev as any).type === "ShowContentEvent") {
            containsShow = true;
            break;
          }
        } catch {
          // ignore individual lookup errors
        }
      }
    } catch (e) {
      // ignore if AppEventService is not available
    }

    if (options && options.manualContentVisible && !containsShow) {
      try {
        eventBus.emit("hideContent");
      } catch {
        // ignore
      }
    }

    for (const eid of ids) {
      try {
        channel.postMessage({ actionType: "start", eventId: eid });
      } catch {
        // swallow post errors
      }
    }
  } finally {
    try {
      channel.close();
    } catch {
      // ignore
    }
  }
}

export default sendShortcutViaChannel;
