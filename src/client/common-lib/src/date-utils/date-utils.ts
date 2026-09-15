export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !isNaN(value.getTime());
}

export function toDateOrNow(value: unknown): Date {
  if (value == null || value === "") return new Date();
  const d = value instanceof Date ? value : new Date(value as any);
  return isNaN(d.getTime()) ? new Date() : d;
}

export function toDateOrNull(value: unknown): Date | null {
  if (value == null || value === "") return null;
  const d = value instanceof Date ? value : new Date(value as any);
  return isNaN(d.getTime()) ? null : d;
}

export function toISOStringSafe(
  value: Date | null | undefined,
  fallbackNow = true
): string | null {
  if (value == null) return fallbackNow ? new Date().toISOString() : null;
  if (isValidDate(value)) return value.toISOString();
  return fallbackNow ? new Date().toISOString() : null;
}

export function toISOStringOrEmpty(value: Date | null | undefined): string {
  const v = toISOStringSafe(value, false);
  return v == null ? "" : v;
}

export default {
  isValidDate,
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
  toISOStringOrEmpty,
};
