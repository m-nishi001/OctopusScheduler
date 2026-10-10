/**
 * 管理系画面へのルーターガード。
 *
 * 管理画面は「設定/アセット/イベント」と各ゲームの `*-admin`。実行画面(投影用の
 * 表示ルート)とクイズ参加者の回答画面(`/quiz/:id/join`)は公開のまま。
 * 開発モードでは何も制限しない(最初の管理者を登録できるようにするため)。
 */
const ADMIN_PATH = /^(?:\/execute)?\/(?:settings|assets|events|sessions|session\/(?:host|console)|(?:jackpot|card|quiz)-admin)(?:\/|$)/;

export function requiresAdmin(path: string): boolean {
  return ADMIN_PATH.test(path);
}

export interface AdminGuardDeps {
  isProduction: () => boolean;
  ensureAdmin: () => Promise<boolean>;
}

export function createAdminGuard(deps: AdminGuardDeps) {
  return async (to: { path: string; fullPath: string }) => {
    if (!deps.isProduction() || !requiresAdmin(to.path)) return true;
    if (await deps.ensureAdmin()) return true;
    return { path: "/login", query: { redirect: to.fullPath } };
  };
}
