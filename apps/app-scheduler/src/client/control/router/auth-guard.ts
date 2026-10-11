/**
 * アプリの入口のルーターガード。
 *
 * 既定で全ルートが管理者ログイン必須(default-deny)。ログイン不要なのは次の最小限だけで、
 * 新しい画面を足してもうっかり公開にならない。
 *   - `/login`           : ログイン画面そのもの
 *   - `/portal`, `/portal/:code` : 参加者の入口(QRコード・参加コード)
 * 投影用の実行画面(`/execute/**`)も、端末ごとに一度ログインすれば以降はトークンで通る。
 * 本当の防御は各エンドポイントの `secure`(サーバー側)で、これは入口のUX。
 */
const PUBLIC_PATH = /^\/(?:login|portal)(?:\/|$)/;

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATH.test(path);
}

export interface AdminGuardDeps {
  ensureAdmin: () => Promise<boolean>;
}

export function createAdminGuard(deps: AdminGuardDeps) {
  return async (to: { path: string; fullPath: string }) => {
    // 参加者の入口では確認通信をしない。
    if (isPublicPath(to.path) && to.path !== "/login") return true;
    const signedIn = await deps.ensureAdmin();
    if (to.path === "/login") return signedIn ? { path: "/home" } : true;
    if (signedIn) return true;
    return { path: "/login", query: { redirect: to.fullPath } };
  };
}
