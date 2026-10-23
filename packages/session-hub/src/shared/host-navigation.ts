/**
 * 管理端末がホスト(プロジェクター)に開かせてよい画面の許可リスト。
 *
 * 管理画面(設定・アカウント等)をホストに開かせない/任意URLへ飛ばさないための制限で、
 * 管理側の入力検証とホスト側の実行時検証の両方で同じ関数を使う(信頼境界はホスト側)。
 */
const SESSION_ID = "[A-Za-z0-9_-]{1,64}";
const SEGMENT = "[^/?#\\s]{1,100}";

const ALLOWED_PATHS: readonly RegExp[] = [
  new RegExp(`^/session/host/${SESSION_ID}$`),
  /^\/(?:execute\/)?jackpot-(?:opening|entry|description|demo|draw|result|history|ending)$/,
  new RegExp(`^/(?:execute/)?quiz/${SEGMENT}/(?:intro|entry|play|answer|result)$`),
  new RegExp(`^/execute/show-(?:image|video|html)/${SEGMENT}$`),
  // 参加者ポータルのイベントのエントリー受付（会場の画面）
  /^\/event-entry$/,
];

const ALLOWED_QUERIES: readonly string[] = ["", "demo=1"];

/** ホスト画面に遷移させてよいパスか(許可した画面だけ。クエリは決まった形のみ)。管理端末の遠隔操作が任意のURLへ飛ばさないための確認。 */
export function isAllowedHostPath(target: unknown): target is string {
  if (typeof target !== "string" || target.length === 0 || target.length > 300) return false;
  if (target.includes("#") || /\s/.test(target)) return false;
  const [path, query = ""] = target.split("?");
  if (target.split("?").length > 2) return false;
  if (!ALLOWED_QUERIES.includes(query)) return false;
  return ALLOWED_PATHS.some((re) => re.test(path));
}

/** セッションのロビー(ホスト画面)のパス。 */
export const lobbyPath = (sessionId: string): string => `/session/host/${sessionId}`;

/**
 * 受付QRに入れるログインURL。キーはフラグメント(#以降)に入れるので、サーバーのログには送られない。
 * ログイン画面が最初にURLからキーを取り除く。
 */
export function buildLoginUrl(id: string, key: string, baseUrl: string): string {
  const base = baseUrl.split("#")[0];
  return `${base}#/login?id=${encodeURIComponent(id)}&key=${encodeURIComponent(key)}`;
}
