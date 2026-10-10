/// <reference types="@cloudflare/workers-types" />

/**
 * Cloudflare Worker のバインディング一覧。
 * `wrangler.toml` の `[[d1_databases]]`/`[[r2_buckets]]`/`[assets]` で定義する
 * バインディング名(DB/BUCKET/ASSETS)と一致させる。
 */
export interface CloudflareEnv {
  DB: D1Database;
  BUCKET: R2Bucket;
  ASSETS: Fetcher;
  /** session-hub のセッション1件ぶんの Durable Object。未設定の環境では R2 版にフォールバックする。 */
  SESSION_ROOM?: DurableObjectNamespace;
  /** 初回管理者のブートストラップ用パスワード(`wrangler secret put`)。管理者が1人でもログイン可能になれば無効。 */
  OCTOPUS_BOOTSTRAP_ADMIN_PASSWORD?: string;
  /** ブートストラップ管理者のID(任意。既定 admin)。 */
  OCTOPUS_BOOTSTRAP_ADMIN_ID?: string;
}
