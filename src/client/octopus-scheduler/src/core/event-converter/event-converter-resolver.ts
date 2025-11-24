import { container } from "tsyringe";
import { IAppEventConverterToken } from "../../model/domains/app-event/i-app-event-converter";
import type { IAppEventConverter } from "../../model/domains/app-event/i-app-event-converter";

/**
 * Stateless resolver for app event converters.
 * Calls the DI container on each invocation and returns the converter
 * whose `getType()` matches the provided type, or null if none found.
 */
export function resolve(type: string): IAppEventConverter | null {
  try {
    const converters = container.resolveAll<any>(
      IAppEventConverterToken as any
    ) as IAppEventConverter[];
    for (const c of converters) {
      if (!c) continue;
      // ensure getType exists and is callable
      if (typeof (c as any).getType !== "function") continue;
      try {
        const t = (c as any).getType();
        if (t === type) return c;
      } catch (e) {
        // ignore converters that fail to report type
      }
    }
  } catch (err) {
    // no converters registered or container not ready
  }
  return null;
}

export default resolve;
