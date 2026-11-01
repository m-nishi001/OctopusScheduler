import { MAX_COMMAND_PAYLOAD_BYTES } from "@octopus/session-hub";
import { parseScreenSpec, type ScreenSpec } from "./screen-spec";

/** 管理端末がホストに送る、音楽とスクリーンの指示の名前空間。 */
export const MEDIA_NS = "media";

/** 指示は4種類だけ。ペイロードは、関数の引数をそのまま送る。 */
export type MediaCommand =
  | { type: "play"; assetId: string }
  | { type: "stop"; assetId?: string; fadeSec?: number }
  | { type: "show"; spec: ScreenSpec }
  | { type: "clear" };

export const MEDIA_COMMAND_TYPES = ["play", "stop", "show", "clear"] as const;

export const ASSET_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
export const MAX_FOLDER_LENGTH = 100;
export const MAX_FADE_SEC = 10;
/** 指示で受け付けるスライドショーの1枚あたりの表示時間(秒)。 */
export const COMMAND_MIN_INTERVAL_SEC = 1;
export const COMMAND_MAX_INTERVAL_SEC = 60;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isAssetId = (v: unknown): v is string => typeof v === "string" && ASSET_ID_PATTERN.test(v);

function payloadBytes(payload: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(payload ?? null)).length;
  } catch {
    return Infinity;
  }
}

/** スクリーンの指定を、指示として受け付ける範囲に絞る。 */
function parseShowSpec(value: unknown): ScreenSpec | null {
  const spec = parseScreenSpec(value);
  if (!spec) return null;
  if (spec.kind === "slideshow") {
    if (spec.folder.length > MAX_FOLDER_LENGTH) return null;
    if (spec.intervalSec < COMMAND_MIN_INTERVAL_SEC || spec.intervalSec > COMMAND_MAX_INTERVAL_SEC) return null;
    return spec;
  }
  return isAssetId(spec.id) ? spec : null;
}

/**
 * `media` 名前空間の指示を検証する。正しければ正規化した指示、そうでなければ null(余分な項目は捨てる)。
 * 検証はここ1か所。ホストは必ずこれを通す(信頼境界はホスト側)。
 */
export function parseMediaCommand(type: string, payload: unknown): MediaCommand | null {
  if (payloadBytes(payload) > MAX_COMMAND_PAYLOAD_BYTES) return null;
  const body = payload === undefined || payload === null ? {} : payload;
  if (!isRecord(body)) return null;
  switch (type) {
    case "play":
      return isAssetId(body.assetId) ? { type, assetId: body.assetId } : null;
    case "stop": {
      const { assetId, fadeSec } = body;
      if (assetId !== undefined && !isAssetId(assetId)) return null;
      if (fadeSec !== undefined && (typeof fadeSec !== "number" || !Number.isFinite(fadeSec) || fadeSec < 0 || fadeSec > MAX_FADE_SEC)) return null;
      return { type, ...(assetId !== undefined ? { assetId } : {}), ...(fadeSec !== undefined ? { fadeSec } : {}) };
    }
    case "show": {
      const spec = parseShowSpec(body.spec);
      return spec ? { type, spec } : null;
    }
    case "clear":
      return { type };
    default:
      return null;
  }
}
