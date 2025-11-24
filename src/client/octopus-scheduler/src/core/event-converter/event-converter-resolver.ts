// Resolver removed — use DI container.resolveAll(IAppEventConverterToken) and find by getType
// This file remains as a compatibility shim that errors loudly to force migration.
export function resolve(_type: string): any {
  throw new Error(
    "event-converter resolver removed: use container.resolveAll(IAppEventConverterToken) and find by getType instead"
  );
}

export default resolve;
