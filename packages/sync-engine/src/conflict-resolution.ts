export type SyncAction = "push" | "pull" | "skip";

export interface SyncSide {
  updatedAt: number;
}

/**
 * ローカル/リモートの更新日時を比較し、どちら向きに同期すべきかを判定する
 * 純粋関数(Last-Write-Wins)。ネットワークやストレージに依存しないため、
 * 単体でテストできる。
 *
 * - 片方だけ存在する場合は、存在する側に合わせる(push/pull)。
 * - 両方存在する場合は、更新日時が新しい側に合わせる。
 * - 両方存在しない、または更新日時が等しい場合は何もしない(skip)。
 */
export function resolveSyncAction(
  local: SyncSide | null,
  remote: SyncSide | null
): SyncAction {
  if (!local && !remote) return "skip";
  if (!local) return "pull";
  if (!remote) return "push";
  if (local.updatedAt > remote.updatedAt) return "push";
  if (remote.updatedAt > local.updatedAt) return "pull";
  return "skip";
}
