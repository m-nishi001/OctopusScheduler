/** スクリーン(投影画面)に出すもの。常に1つだけ。 */
export type ScreenSpec =
  | { kind: "image" | "video"; id: string }
  | { kind: "slideshow"; folder: string; intervalSec: number; transition: SlideTransition };

export type SlideTransition = "fade" | "slide";

export const MIN_INTERVAL_SEC = 1;
export const MAX_INTERVAL_SEC = 3600;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/**
 * 外から来た値を、スクリーンの指定として検証する。正しければ正規化した値、そうでなければ null。
 * 余分な項目は捨てる。
 */
export function parseScreenSpec(value: unknown): ScreenSpec | null {
  if (!isRecord(value)) return null;
  if (value.kind === "image" || value.kind === "video") {
    return isText(value.id) ? { kind: value.kind, id: value.id } : null;
  }
  if (value.kind === "slideshow") {
    const { folder, intervalSec, transition } = value;
    if (!isText(folder) || folder.includes("/")) return null;
    if (typeof intervalSec !== "number" || !Number.isFinite(intervalSec)) return null;
    if (intervalSec < MIN_INTERVAL_SEC || intervalSec > MAX_INTERVAL_SEC) return null;
    if (transition !== "fade" && transition !== "slide") return null;
    return { kind: "slideshow", folder: folder.trim(), intervalSec, transition };
  }
  return null;
}
