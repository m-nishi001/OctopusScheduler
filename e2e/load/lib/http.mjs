// RPC(POST /rpc)の呼び出し。所要時間と、HTTP の失敗(429 / 5xx / 接続断)を計測する。

export class RpcError extends Error {
  /** @param {{name: string, message: string, status: number, code: string | null, retryAfter: string | null}} info */
  constructor(info) {
    super(`${info.name}: ${info.message}`);
    this.name = "RpcError";
    this.rpcName = info.name;
    this.status = info.status;
    /** サーバが付けたエラーコード(例: ROUND_CLOSED)。無ければ null。 */
    this.code = info.code;
    this.retryAfter = info.retryAfter;
  }
}

const CODE_PATTERN = /\[([A-Z_]+)\]/;
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * @param {{base: string, metrics: import("./metrics.mjs").Metrics}} env
 * @param {string} name RPC 名(例: sessionHub_poll)
 * @param {unknown} args
 * @param {string | null} [token] 管理者などのログイントークン
 * @param {{expect?: string[], expectMessage?: RegExp, soft?: boolean}} [options] expect: 想定内のエラーコード(失敗として数えない) /
 *   expectMessage: コードの付かないエラー(例: Unauthorized)を想定内とする /
 *   soft: 呼び出し側が再試行するので、失敗は警告として数える(最後の試行は soft にしない)
 */
export async function rpc(env, name, args, token = null, options = {}) {
  const body = { name, args: token ? { __octopusAuth: token, args } : args };
  const started = Date.now();
  const fail = (kind, detail) => (options.soft ? env.metrics.warn(kind, detail) : env.metrics.error(kind, detail));
  let res;
  try {
    res = await fetch(`${env.base}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (cause) {
    env.metrics.count("http:network-error");
    fail("network", `${name}: ${cause?.message ?? cause}`);
    throw new RpcError({ name, message: `network: ${cause?.message ?? cause}`, status: 0, code: null, retryAfter: null });
  }
  const elapsed = Date.now() - started;
  env.metrics.time(`rpc:${name}`, elapsed);
  env.metrics.count(`http:${res.status}`);
  const retryAfter = res.headers.get("retry-after");
  let json = null;
  try {
    json = await res.json();
  } catch {
    // JSON でない応答(429 や 5xx のエラーページなど)
  }
  if (res.status === 429 || res.status >= 500) fail(`http-${res.status}`, `${name} (retry-after: ${retryAfter ?? "-"})`);
  if (!json || json.status !== "success") {
    const message = json?.message ?? `HTTP ${res.status}`;
    const code = CODE_PATTERN.exec(message)?.[1] ?? null;
    const expected = options.expect?.includes(code) || options.expectMessage?.test(message);
    if (!expected && res.status < 500 && res.status !== 429) fail("rpc", `${name}: ${message}`);
    throw new RpcError({ name, message, status: res.status, code, retryAfter });
  }
  return json.data;
}
