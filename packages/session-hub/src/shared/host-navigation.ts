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
  /^\/(?:execute\/)?jackpot-(?:opening|description|demo|draw|result|history|ending)$/,
  new RegExp(`^/(?:execute/)?quiz/${SEGMENT}/(?:intro|qr|play|answer|result)$`),
  new RegExp(`^/execute/show-(?:image|video|html)/${SEGMENT}$`),
];

const ALLOWED_QUERIES: readonly string[] = ["", "demo=1"];

export function isAllowedHostPath(target: unknown): target is string {
  if (typeof target !== "string" || target.length === 0 || target.length > 300) return false;
  if (target.includes("#") || /\s/.test(target)) return false;
  const [path, query = ""] = target.split("?");
  if (target.split("?").length > 2) return false;
  if (!ALLOWED_QUERIES.includes(query)) return false;
  return ALLOWED_PATHS.some((re) => re.test(path));
}

export const lobbyPath = (sessionId: string): string => `/session/host/${sessionId}`;

/** 参加者向けポータルの絶対URL。GAS ではデプロイURL(取得できれば)を基点にする。 */
export function buildPortalUrl(code: string, baseUrl: string): string {
  const base = baseUrl.split("#")[0];
  return `${base}#/portal/${encodeURIComponent(code)}`;
}
