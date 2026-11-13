import type { Member } from "./member";

/** ジャックポットの抽選対象の既定値。管理者かどうかとは無関係に、全員が対象から始まる。 */
export const DEFAULT_ELIGIBLE = true;

/** メンバー拡張設定のうち、抽選対象の判定に使う部分(`MemberRepository.readExtras()` の値がそのまま満たす)。 */
export type EligibilityExtras = ReadonlyMap<string, { eligible?: boolean }>;

/** 抽選の対象になるメンバーだけに絞る(管理者かどうかは見ない)。 */
export const eligibleOnly = <T extends Pick<Member, "eligible">>(members: readonly T[]): T[] => members.filter((m) => m.eligible ?? DEFAULT_ELIGIBLE);

/**
 * メンバーIDの一覧から、抽選の対象でない人を除く(重複も除く)。判定は `eligible` だけで、管理者かどうかは見ない。
 * 拡張設定に載っていない人は既定(対象)として扱う。抽選の対象の判定は、アプリのどこでもこの関数を使う。
 */
export function filterEligibleIds(ids: Iterable<string>, extras: EligibilityExtras): string[] {
  return [...new Set(ids)].filter((id) => extras.get(id)?.eligible ?? DEFAULT_ELIGIBLE);
}
