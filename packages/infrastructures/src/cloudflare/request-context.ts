/**
 * リクエストスコープの env バインディングを保持する。
 *
 * GAS の各種グローバル(PropertiesService 等)は常にアンビエントに参照できるが、
 * Cloudflare の env(D1/R2バインディング)は `fetch(request, env, ctx)` の中でしか
 * 得られない。resolveDeps() などの既存呼び出し元を変更せずに済むよう、
 * リクエスト処理の入口で AsyncLocalStorage に env を積んでおき、
 * cloudflare/ 配下の各アダプターはここから読み出す。
 *
 * `nodejs_compat` フラグ(wrangler.toml)が必要。
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { CloudflareEnv } from "./env";

const als = new AsyncLocalStorage<CloudflareEnv>();

export function runWithRequestEnv<T>(env: CloudflareEnv, fn: () => T | Promise<T>): Promise<T> {
  return als.run(env, async () => fn());
}

export function currentEnv(): CloudflareEnv {
  const env = als.getStore();
  if (!env) {
    throw new Error("No Cloudflare Env bound to the current async context.");
  }
  return env;
}
