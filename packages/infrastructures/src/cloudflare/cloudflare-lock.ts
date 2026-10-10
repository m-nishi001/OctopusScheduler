import { injectable } from "tsyringe";
import type { ILock } from "../interfaces/lock";
import { currentEnv } from "./request-context";

/** 保持者がクラッシュしても他者が奪取できるようにするリース期間。 */
const LEASE_MS = 30_000;
const RETRY_INTERVAL_MS = 50;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * ILock の Cloudflare 実装。
 *
 * D1の行に対する条件付きUPSERT(SQLiteの `ON CONFLICT ... DO UPDATE ... WHERE`)で
 * 排他制御を疑似的に実現する。既存のロック行が期限切れの場合のみ更新が成立する
 * 単一SQL文のCAS(compare-and-swap)。
 *
 * - 取得できない間は `timeoutMs` まで待つ(GAS の LockService.waitLock と同じ意味)。
 * - 解放は自分の owner の行に限る。リース切れで他者に奪取された後に、元の保持者が
 *   他者のロックを消すことはない。
 *
 * 数百人規模のリアルタイム排他は Durable Object(単一スレッド直列実行)に任せ、
 * このロックは管理系の低頻度な書き込みの保護に使う。
 */
@injectable()
export class CloudflareLock implements ILock {
  async withLock<T>(key: string, timeoutMs: number, fn: () => Promise<T> | T): Promise<T> {
    const db = currentEnv().DB;
    const owner = crypto.randomUUID();
    const deadline = Date.now() + timeoutMs;

    // eslint-disable-next-line no-constant-condition
    while (true) {
      const now = Date.now();
      const result = await db
        .prepare(
          `INSERT INTO locks (key, expires_at, owner) VALUES (?1, ?2, ?3)
           ON CONFLICT(key) DO UPDATE SET expires_at = excluded.expires_at, owner = excluded.owner
           WHERE locks.expires_at < ?4`
        )
        .bind(key, now + LEASE_MS, owner, now)
        .run();
      if (result.meta.changes) break;
      if (now >= deadline) throw new Error("Server is busy, please try again.");
      await sleep(RETRY_INTERVAL_MS);
    }

    try {
      return await fn();
    } finally {
      await db.prepare("DELETE FROM locks WHERE key = ?1 AND owner = ?2").bind(key, owner).run();
    }
  }
}
