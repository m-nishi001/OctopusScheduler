/**
 * アプリの入口のルーターガード。
 *
 * 既定で全ルートが管理者ログイン必須(default-deny)。例外は次の最小限だけで、
 * 新しい画面を足してもうっかり公開にならない。
 *   - `/login`           : ログイン画面そのもの(ログイン済みなら役割ごとの着地先へ)
 *   - `/p`, `/p/**`      : 参加者ポータル。ログイン済みなら管理者・参加者のどちらも入れる
 * 参加者はログイン必須(匿名の参加は無い)。
 * 同じURLから入り、役割(管理者 / 参加者)で表示する画面を出し分ける。参加者が管理画面を
 * 直打ちしても、参加者ポータルへ戻される。
 * 投影用の実行画面(`/execute/**`)も、端末ごとに一度ログインすれば以降はトークンで通る。
 * 本当の防御は各エンドポイントの `secure`(サーバー側)で、これは入口のUX。
 */
export type Role = "admin" | "participant";

const PUBLIC_PATH = /^\/login(?:\/|$)/;
const PARTICIPANT_PATH = /^\/p(?:\/|$)/;

const ADMIN_HOME = "/home";
const PARTICIPANT_HOME = "/p";

/** ログイン不要の画面(`/login`)か。 */
export function isPublicPath(path: string): boolean {
  return PUBLIC_PATH.test(path);
}

/** 参加者ポータル(`/p` 以下)か。参加者が入れるのはここだけ。 */
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

/** ルーターの入口のガードを作る。未ログインなら `/login` へ(戻り先つき)、参加者が管理画面へ行こうとしたら参加者ポータルへ戻す。 */
export function createAuthGuard(deps: AuthGuardDeps) {
  return async (to: { path: string; fullPath: string }) => {
    const role = await deps.getRole();
    if (to.path === "/login") return role ? { path: landingPath(role) } : true;
    if (!role) return { path: "/login", query: { redirect: to.fullPath } };
    if (isParticipantPath(to.path)) return true;
    return role === "admin" ? true : { path: PARTICIPANT_HOME };
  };
}
