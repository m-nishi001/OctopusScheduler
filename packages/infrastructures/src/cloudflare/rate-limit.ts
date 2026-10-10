/**
 * 入口のレート制限(Workers Rate Limiting バインディング)。
 * R2/D1/Durable Object に触る前に弾き、無差別アクセスで操作数(R2 は従量課金)が増えるのを防ぐ。
 * バインディングが無い環境(古い wrangler.toml・テスト)では何もしない。
 * カウンタは Cloudflare のロケーションごとの結果整合で、厳密な上限ではない。
 */
import type { CloudflareEnv } from "./env";

/** パスワード総当たりの対象になる RPC。厳格な上限をかける。 */
const STRICT_RPC_NAMES = new Set(["accounts_login"]);

export type LimiterKind = "login" | "public";

export function limiterKindForRpc(name: unknown): LimiterKind {
  return typeof name === "string" && STRICT_RPC_NAMES.has(name) ? "login" : "public";
}

/** 接続元IP。取れない場合は共通キーにまとめる(全体で上限を共有する安全側)。 */
export function clientKey(request: Request): string {
  return request.headers.get("CF-Connecting-IP") ?? "unknown";
}

/** 上限内なら true。バインディング未設定も true。 */
export async function allowRequest(env: CloudflareEnv, kind: LimiterKind, key: string): Promise<boolean> {
  const limiter = kind === "login" ? env.LOGIN_LIMITER : env.PUBLIC_LIMITER;
  if (!limiter) return true;
  const { success } = await limiter.limit({ key });
  return success;
}

export function tooManyRequests(): Response {
  return Response.json(
    { status: "error", message: "Too many requests", retryable: false },
    { status: 429, headers: { "Retry-After": "60" } }
  );
}
