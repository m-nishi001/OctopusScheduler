import { injectable } from "tsyringe";
import type { ICache } from "../interfaces/cache";
import { currentEnv } from "./request-context";

/**
 * ICache の Cloudflare 実装(D1)。
 *
 * dedupe-guard.ts が要求する「即時の read-your-write整合性」は、PoP局所的な
 * Cache API では満たせないため、単一の論理DBであるD1に持たせる。
 */
@injectable()
export class CloudflareCache implements ICache {
  async get(key: string): Promise<string | null> {
    const row = await currentEnv()
      .DB.prepare("SELECT value FROM cache_entries WHERE key = ?1 AND expires_at > ?2")
      .bind(key, Date.now())
      .first<{ value: string }>();
    return row ? row.value : null;
  }

  async put(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    await currentEnv()
      .DB.prepare(
        `INSERT INTO cache_entries (key, value, expires_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, expires_at = excluded.expires_at`
      )
      .bind(key, value, expiresAt)
      .run();
  }

  async remove(key: string): Promise<void> {
    await currentEnv().DB.prepare("DELETE FROM cache_entries WHERE key = ?1").bind(key).run();
  }
}
