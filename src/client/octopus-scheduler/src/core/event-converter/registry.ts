import { container } from "tsyringe";
import { IAppEventConverterToken } from "../../model/domains/app-event/i-app-event-converter";
import type { IAppEventConverter } from "../../model/domains/app-event/i-app-event-converter";

let cached: Map<string, IAppEventConverter> | null = null;

function buildMap(): Map<string, IAppEventConverter> {
  const map = new Map<string, IAppEventConverter>();
  try {
    const converters = container.resolveAll<any>(IAppEventConverterToken as any) as IAppEventConverter[];
    converters.forEach((c) => {
      try {
        const t = c.getType();
        if (t) map.set(t, c);
      } catch (e) {
        // ignore converter that doesn't report type
      }
    });
  } catch (err) {
    // no converters registered
  }
  return map;
}

export function getConverterForType(type: string): IAppEventConverter | null {
  if (!cached) cached = buildMap();
  return cached.get(type) || null;
}

export function refreshConverterCache() {
  cached = buildMap();
}
