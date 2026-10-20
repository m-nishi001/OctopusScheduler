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

/**
 * `<input type="datetime-local">` に入れる文字列(`YYYY-MM-DDTHH:mm`)にする。端末のローカル時刻で表す
 * (入力欄はタイムゾーンを持たない「壁時計」の値。UTC の `toISOString()` を使うと、日本では 9 時間ずれる)。
 */
export function toDatetimeLocal(date: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * `<input type="datetime-local">` の値(`YYYY-MM-DDTHH:mm`)を、端末のローカル時刻として Date にする。
 * {@link toDatetimeLocal} の逆。
 */
export function fromDatetimeLocal(value: string): Date {
  return new Date(value);
}

export default {
  isValidDate,
  toDateOrNow,
  toDateOrNull,
  toISOStringSafe,
  toISOStringOrEmpty,
  toDatetimeLocal,
  fromDatetimeLocal,
};
