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
}
