/**
 * サーバが `nextPollMs` として返す適応的なポーリング間隔の計算(純粋関数)。
 *
 * 操作が活発な間は短く、静かな間は徐々に延ばす。役割ごとに「操作から遅延が体感できる
 * 下限」と「静かなときの上限」を持つ。GAS の同時実行/クォータを守りつつ、操作直後の
 * 反映は速くするのが目的。
 */
import type { DeviceRole } from "./session-types";

export interface PollIntervalPolicy {
  /** 活動直後の間隔(ms)。 */
  activeMs: number;
  /** 静穏時の上限(ms)。 */
  idleMaxMs: number;
}

export const POLL_POLICIES: Record<DeviceRole, PollIntervalPolicy> = {
  host: { activeMs: 1000, idleMaxMs: 4000 },
  admin: { activeMs: 2000, idleMaxMs: 6000 },
  client: { activeMs: 3000, idleMaxMs: 15000 },
};

/** この時間活動が無ければ静穏とみなして間隔を延ばし始める。 */
const QUIET_AFTER_MS = 20_000;
/** 静穏が続くごとに間隔を伸ばす刻み幅の基準(段階的に idleMaxMs へ)。 */
const RAMP_MS = 60_000;

/**
 * @param role 端末の役割
 * @param sinceLastActivityMs 直近のコマンド/状態更新からの経過時間
 */
export function computeNextPollMs(role: DeviceRole, sinceLastActivityMs: number): number {
  const { activeMs, idleMaxMs } = POLL_POLICIES[role];
  if (sinceLastActivityMs <= QUIET_AFTER_MS) return activeMs;
  const progress = Math.min(1, (sinceLastActivityMs - QUIET_AFTER_MS) / RAMP_MS);
  return Math.round(activeMs + (idleMaxMs - activeMs) * progress);
}
