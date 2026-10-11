/**
 * アプリの入口のルーターガード。
 *
 * 既定で全ルートが管理者ログイン必須(default-deny)。例外は次の最小限だけで、
 * 新しい画面を足してもうっかり公開にならない。
 *   - `/login`           : ログイン画面そのもの(ログイン済みなら役割ごとの着地先へ)
 *   - `/portal`, `/portal/:code` : 匿名参加の入口(QRコード・参加コード)
 *   - `/p`, `/p/**`      : 参加者ポータル。ログイン済みなら管理者・参加者のどちらも入れる
 * 同じURLから入り、役割(管理者 / 参加者)で表示する画面を出し分ける。参加者が管理画面を
 * 直打ちしても、参加者ポータルへ戻される。
 * 投影用の実行画面(`/execute/**`)も、端末ごとに一度ログインすれば以降はトークンで通る。
 * 本当の防御は各エンドポイントの `secure`(サーバー側)で、これは入口のUX。
 */
export type Role = "admin" | "participant";

const PUBLIC_PATH = /^\/(?:login|portal)(?:\/|$)/;
const PARTICIPANT_PATH = /^\/p(?:\/|$)/;

export const ADMIN_HOME = "/home";
export const PARTICIPANT_HOME = "/p";

export function isPublicPath(path: string): boolean {
  return PUBLIC_PATH.test(path);
}

export function isParticipantPath(path: string): boolean {
  return PARTICIPANT_PATH.test(path);
}

/** 役割ごとの着地先。 */
export function landingPath(role: Role): string {
  return role === "admin" ? ADMIN_HOME : PARTICIPANT_HOME;
}

/**
 * ログイン後の戻り先。同一アプリ内のパスのみ許可する(オープンリダイレクト対策)。
 * 参加者は参加者ポータル以外へは戻さない(管理画面へ行こうとしても着地先に落とす)。
 */
export function resolveLoginRedirect(role: Role, redirect: unknown): string {
  if (typeof redirect !== "string" || !redirect.startsWith("/") || redirect.startsWith("//")) return landingPath(role);
  const path = redirect.split(/[?#]/)[0];
  if (role === "participant" && !isParticipantPath(path)) return landingPath(role);
  return redirect;
}

export interface AuthGuardDeps {
  /** 今ログインしている人の役割。未ログイン(または確認できない)なら null。 */
  getRole: () => Promise<Role | null>;
}

export function createAuthGuard(deps: AuthGuardDeps) {
  return async (to: { path: string; fullPath: string }) => {
    // 匿名参加の入口では確認通信をしない。
    if (isPublicPath(to.path) && to.path !== "/login") return true;
    const role = await deps.getRole();
    if (to.path === "/login") return role ? { path: landingPath(role) } : true;
    if (!role) return { path: "/login", query: { redirect: to.fullPath } };
    if (isParticipantPath(to.path)) return true;
    return role === "admin" ? true : { path: PARTICIPANT_HOME };
  };
}
