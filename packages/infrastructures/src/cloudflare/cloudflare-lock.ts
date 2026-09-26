import { injectable } from "tsyringe";
import type { ILock } from "../interfaces/lock";
import { currentEnv } from "./request-context";

/**
 * ILock の Cloudflare 実装。
 *
 * Durable Objectsは導入せず、D1の行に対する条件付きUPSERT(SQLiteの
 * `ON CONFLICT ... DO UPDATE ... WHERE`)で排他制御を疑似的に実現する。
 * 既存のロック行が期限切れの場合のみ更新が成立するため、単一SQL文の原子性を
 * 利用したCAS(compare-and-swap)として機能する。
 */
@injectable()
export class CloudflareLock implements ILock {
  async withLock<T>(key: string, timeoutMs: number, fn: () => Promise<T> | T): Promise<T> {
    const db = currentEnv().DB;
    const now = Date.now();
    const expiresAt = now + timeoutMs;

    const result = await db
      .prepare(
        `INSERT INTO locks (key, expires_at) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at
         WHERE locks.expires_at < ?3`
      )
      .bind(key, expiresAt, now)
      .run();

    if (!result.meta.changes) {
      throw new Error("Server is busy, please try again.");
    }

    try {
      return await fn();
    } finally {
      await db.prepare("DELETE FROM locks WHERE key = ?1").bind(key).run();
    }
  }
}
