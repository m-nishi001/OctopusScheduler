// Adapter registry that builds on the existing keyboard shortcut action-registry
import ACTION_REGISTRY from "../../keyboard-shortcut/action-registry";
import type { ActionEntry } from "./action-entry";
import type { EventDto, ActionType } from "../types";

// Build a minimal adapter around existing entries so callers can use
// getDefault / toDto / toEntity shape without breaking existing code.
const ADAPTER_REGISTRY: Record<string, ActionEntry<any, any>> = {};

Object.keys(ACTION_REGISTRY).forEach((k) => {
  const entry = (ACTION_REGISTRY as any)[k];
  ADAPTER_REGISTRY[k] = {
    actionType: k,
    label: entry.label,
    component: entry.component,
    // New default uses existing getInitial with an empty object fallback
    getDefault: () => (entry.getInitial ? entry.getInitial({}) : {}),
    // toDto: when given a model event, call getInitial to extract dto-like data
    toDto: (ev: any) => (entry.getInitial ? entry.getInitial(ev) : {}),
    // toEntity: reuse buildEvent
    toEntity: (id: string, now: Date, data: any) =>
      entry.buildEvent(id, now, data),
    validate: entry.validate,
  };
});

export function getAppEventRegistry(): Record<string, ActionEntry<any, any>> {
  return ADAPTER_REGISTRY;
}

export default ADAPTER_REGISTRY;
