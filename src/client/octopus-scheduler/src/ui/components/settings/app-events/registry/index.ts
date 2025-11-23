// Adapter registry that builds on the existing keyboard shortcut action-registry
import ACTION_REGISTRY from "../../keyboard-shortcut/action-registry";
import type { ActionEntry } from "./action-entry";
import type { EventDto, ActionType } from "../types";
import { getConverterForType } from "../../../../core/event-converter/registry";

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
    getDefault: () => {
      const conv = getConverterForType(k);
      if (conv && conv.getInitial) return conv.getInitial({});
      return entry.getInitial ? entry.getInitial({}) : {};
    },
    // toDto: when given a model event, call converter.getInitial if available
    toDto: (ev: any) => {
      const conv = getConverterForType(k);
      if (conv && conv.getInitial) return conv.getInitial(ev);
      return entry.getInitial ? entry.getInitial(ev) : {};
    },
    // toEntity: prefer converter.toEntityFromForm
    toEntity: (id: string, now: Date, data: any) => {
      const conv = getConverterForType(k);
      if (conv && conv.toEntityFromForm) return conv.toEntityFromForm(data, { id, now });
      return entry.buildEvent(id, now, data);
    },
    validate: (data: any) => {
      const conv = getConverterForType(k);
      if (conv && conv.validate) return conv.validate(data);
      return entry.validate ? entry.validate(data) : true;
    },
  };
});

export function getAppEventRegistry(): Record<string, ActionEntry<any, any>> {
  return ADAPTER_REGISTRY;
}

export default ADAPTER_REGISTRY;
