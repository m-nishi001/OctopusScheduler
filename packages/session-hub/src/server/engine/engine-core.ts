/**
 * セッションエンジンの共通部分: 依存(EngineDeps)・端末の認証・小さな部品。
 * 操作ごとのロジックは engine-join / engine-feed / engine-commands / engine-rounds。
 */
import type { Device, PresenceEntry, SessionMeta } from "../../shared/session-types";
import type { DeviceCredentials } from "../../shared/protocol";
import { hubError } from "./hub-error";
import type { PresenceStore, SessionRepo, StoredHead } from "./session-repo";

export interface EngineDeps {
  /** 回答ラウンドで受け付けられる回答数の上限(KV は少なく、Durable Object は多い)。 */
  maxAnswers?: number;
  repo: SessionRepo;
  presence: PresenceStore;
  now: () => number;
  newId: () => string;
  newToken: () => string;
}

const MAX_LABEL_LENGTH = 60;
/** まだ1件もコマンド・状態が無いセッションの、先頭情報(seq 0・状態の版 0)。 */
export const EMPTY_HEAD = (meta: SessionMeta): StoredHead => ({
  seq: 0,
  stateVersion: 0,
  updatedAtMs: meta.createdAtMs,
  recent: [],
});

/** タイミング差でトークンが推測されにくいよう全桁を比較する。 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 値を JSON にしたときの UTF-8 のバイト数(日本語は3バイト)。ペイロードの大きさの上限の判定に使う。 */
export function jsonBytes(value: unknown): number {
  const s = JSON.stringify(value) ?? "";
  // UTF-8 のバイト数(日本語は3バイト)。TextEncoder が無い環境でも動くよう手計算する。
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

/** 表示名を整える。前後の空白を除き、長すぎれば切り、空なら `fallback`。 */
export function cleanLabel(label: string | undefined, fallback: string): string {
  const trimmed = (label ?? "").trim().slice(0, MAX_LABEL_LENGTH);
  return trimmed || fallback;
}

/** セッションの情報を読む。無ければ SESSION_NOT_FOUND、終了済みか期限切れなら SESSION_CLOSED。 */
export async function loadMeta(repo: SessionRepo, now: number): Promise<SessionMeta> {
  const meta = await repo.getMeta();
  if (!meta) throw hubError("SESSION_NOT_FOUND", "セッションが見つかりません");
  if (meta.status === "closed" || meta.expiresAtMs <= now) {
    throw hubError("SESSION_CLOSED", "セッションは終了しています");
  }
  return meta;
}

/** 端末の認証。セッションが有効で、deviceId と token が一致するときだけ端末を返す。 */
export async function authenticate(
  deps: Pick<EngineDeps, "repo" | "now">,
  creds: DeviceCredentials
): Promise<{ meta: SessionMeta; device: Device }> {
  const meta = await loadMeta(deps.repo, deps.now());
  const device = creds.deviceId ? await deps.repo.getDevice(creds.deviceId) : null;
  if (!device || !creds.token || !safeEqual(device.token, creds.token)) {
    throw hubError("DEVICE_UNAUTHORIZED", "端末を認証できません。入室し直してください");
  }
  return { meta, device };
}

/** 在席の記録が、閾値(ミリ秒)以内に更新されているか。 */
export function isAlive(entry: PresenceEntry | undefined, now: number, thresholdMs: number): boolean {
  return !!entry && now - entry.seenAtMs <= thresholdMs;
}
