// Adapter removed: behavioral responsibilities are now implemented by
// DI-resolved converters under `core/event-converter` and UI should
// use the converter registry (`getConverterForType`). This adapter
// was intentionally deleted as part of the converter-first migration.

export function getAppEventRegistry(): Record<string, never> {
  throw new Error(
    "app-events adapter removed: use resolve(type) from core/event-converter/event-converter-resolver and the UI-only action registry instead"
  );
}

export default getAppEventRegistry;
