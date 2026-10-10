import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CloudflareLock } from "../cloudflare-lock";
import { runWithRequestEnv } from "../request-context";
import type { CloudflareEnv } from "../env";

interface Row {
  expires_at: number;
  owner: string;
}

/** locks テーブルに対する2種類のSQLだけを解釈する最小のD1フェイク。 */
function createFakeD1() {
  const rows = new Map<string, Row>();
  const db = {
    prepare(sql: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async run() {
              if (sql.startsWith("INSERT INTO locks")) {
                const [key, expiresAt, owner, now] = params as [string, number, string, number];
                const existing = rows.get(key);
                if (existing && !(existing.expires_at < now)) return { meta: { changes: 0 } };
                rows.set(key, { expires_at: expiresAt, owner });
                return { meta: { changes: 1 } };
              }
              if (sql.startsWith("DELETE FROM locks")) {
                const [key, owner] = params as [string, string];
                if (rows.get(key)?.owner === owner) {
                  rows.delete(key);
                  return { meta: { changes: 1 } };
                }
                return { meta: { changes: 0 } };
              }
              throw new Error(`unexpected sql: ${sql}`);
            },
          };
        },
      };
    },
  };
  return { rows, env: { DB: db } as unknown as CloudflareEnv };
}

describe("CloudflareLock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fn の完了後にロックを解放する", async () => {
    const { rows, env } = createFakeD1();
    const lock = new CloudflareLock();
    const result = await runWithRequestEnv(env, () => lock.withLock("k", 1000, async () => 42));
    expect(result).toBe(42);
    expect(rows.size).toBe(0);
  });

  it("fn が例外でもロックを解放する", async () => {
    const { rows, env } = createFakeD1();
    const lock = new CloudflareLock();
    await expect(
      runWithRequestEnv(env, () =>
        lock.withLock("k", 1000, async () => {
          throw new Error("boom");
        })
      )
    ).rejects.toThrow("boom");
    expect(rows.size).toBe(0);
  });

  it("保持中は待機し、解放後に取得できる(直列化される)", async () => {
    const { env } = createFakeD1();
    const lock = new CloudflareLock();
    const order: string[] = [];
    const first = runWithRequestEnv(env, () =>
      lock.withLock("k", 5000, async () => {
        order.push("a:start");
        await new Promise((r) => setTimeout(r, 200));
        order.push("a:end");
      })
    );
    const second = runWithRequestEnv(env, () =>
      lock.withLock("k", 5000, async () => {
        order.push("b:start");
      })
    );
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);
    expect(order).toEqual(["a:start", "a:end", "b:start"]);
  });

  it("timeoutMs を超えて取得できなければ busy エラーにする", async () => {
    const { env } = createFakeD1();
    const lock = new CloudflareLock();
    const holder = runWithRequestEnv(env, () =>
      lock.withLock("k", 5000, () => new Promise<void>((r) => setTimeout(r, 10_000)))
    );
    const waiter = runWithRequestEnv(env, () => lock.withLock("k", 300, async () => "never"));
    const assertion = expect(waiter).rejects.toThrow("Server is busy");
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    await vi.advanceTimersByTimeAsync(10_000);
    await holder;
  });

  it("リース切れで奪取された後、元の保持者の解放は他者のロックを消さない", async () => {
    const { rows, env } = createFakeD1();
    const lock = new CloudflareLock();
    // 保持者A: リース(30s)を超えて処理が長引く
    const a = runWithRequestEnv(env, () =>
      lock.withLock("k", 100, () => new Promise<void>((r) => setTimeout(r, 40_000)))
    );
    await vi.advanceTimersByTimeAsync(31_000);
    // Bがリース切れのロックを奪取し、処理中
    const b = runWithRequestEnv(env, () =>
      lock.withLock("k", 100, () => new Promise<void>((r) => setTimeout(r, 20_000)))
    );
    await vi.advanceTimersByTimeAsync(100);
    const ownerOfB = rows.get("k")?.owner;
    expect(ownerOfB).toBeDefined();
    // Aが終了(finally)してもBのロックは残る
    await vi.advanceTimersByTimeAsync(10_000);
    await a;
    expect(rows.get("k")?.owner).toBe(ownerOfB);
    await vi.advanceTimersByTimeAsync(20_000);
    await b;
    expect(rows.size).toBe(0);
  });
});
