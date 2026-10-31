import type { RosterUsage } from "@octopus/accounts";

/** この割合を超えたら、上限が近いと警告する。 */
export const ROSTER_WARN_RATIO = 0.8;

export interface RosterCapacityView {
  /** 使用率(0〜100、小数点以下切り捨て)。 */
  percent: number;
  /** ok: 余裕あり / warn: 上限が近い / full: ほぼ満杯(あと数人で追加できなくなる)。 */
  level: "ok" | "warn" | "full";
  /** 画面に出す案内。余裕があるときは短い使用状況だけ。 */
  message: string;
}

/**
 * 名簿の容量の使用状況から、画面に出す警告を決める。上限の無い保存先(Cloudflare)では null(何も出さない)。
 * 1 人あたりの大きさ(平均)から、あと何人入るかの目安も伝える。
 */
export function describeRosterCapacity(usage: RosterUsage): RosterCapacityView | null {
  if (usage.maxBytes === null || usage.maxBytes <= 0) return null;
  const ratio = usage.usedBytes / usage.maxBytes;
  const percent = Math.floor(ratio * 100);
  const perMember = usage.members > 0 ? usage.usedBytes / usage.members : 0;
  const remaining = perMember > 0 ? Math.max(0, Math.floor((usage.maxBytes - usage.usedBytes) / perMember)) : null;
  const used = `名簿の容量: ${percent}% 使用中(${usage.members}人)`;

  if (ratio >= 0.95) {
    return {
      percent,
      level: "full",
      message: `${used}。あと${remaining ?? 0}人ほどで登録できなくなります。使わない人を削除してください。`,
    };
  }
  if (ratio >= ROSTER_WARN_RATIO) {
    return {
      percent,
      level: "warn",
      message: `${used}。上限が近づいています(あと${remaining ?? 0}人ほど)。`,
    };
  }
  return { percent, level: "ok", message: used };
}
