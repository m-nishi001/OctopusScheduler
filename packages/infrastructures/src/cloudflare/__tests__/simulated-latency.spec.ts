import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseLatencyMs, sampleLatencyMs, withSimulatedLatency } from "../simulated-latency";
import type { CloudflareEnv } from "../env";

function fakeEnv(extra: Partial<CloudflareEnv> = {}) {
  const calls: string[] = [];
  const bucket = {
    async get(key: string) {
      calls.push(`get:${key}`);
      return { text: async () => "v" };
    },
    async put(key: string) {
      calls.push(`put:${key}`);
    },
  };
  const db = {
    prepare(sql: string) {
      const statement = {
        bind(...params: unknown[]) {
          calls.push(`bind:${params.join(",")}`);
          return statement;
        },
        async run() {
          calls.push(`run:${sql}`);
          return { meta: { changes: 1 } };
        },
      };
      return statement;
    },
  };
  const env = { BUCKET: bucket, DB: db, ...extra } as unknown as CloudflareEnv;
  return { env, calls, bucket, db };
}

describe("parseLatencyMs", () => {
  it("正の数だけ有効。未設定・不正・0以下は 0(遅延なし)", () => {
    expect(parseLatencyMs("80")).toBe(80);
    expect(parseLatencyMs(undefined)).toBe(0);
    expect(parseLatencyMs("")).toBe(0);
    expect(parseLatencyMs("abc")).toBe(0);
    expect(parseLatencyMs("-5")).toBe(0);
    expect(parseLatencyMs("0")).toBe(0);
  });
});

describe("sampleLatencyMs", () => {
  it("まれに(2%)4倍の裾野がある", () => {
    // 1回目の random() がばらつき、2回目が裾野の判定
    const seq = [0.5, 0.01];
    expect(sampleLatencyMs(100, () => seq.shift()!)).toBeCloseTo(400, 5);
  });

  it("通常の呼び出しは 60〜140ms(平均100ms)", () => {
    const values = [0.1, 0.5, 0.99];
    for (const r of values) {
      const ms = sampleLatencyMs(100, () => r);
      expect(ms).toBeGreaterThanOrEqual(60);
      expect(ms).toBeLessThanOrEqual(140);
    }
  });

  it("平均 0 以下なら遅延なし", () => {
    expect(sampleLatencyMs(0)).toBe(0);
  });
});

describe("withSimulatedLatency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0.5); // ばらつきなし・裾野なし(0.5 > 0.02)
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("環境変数が無ければ env をそのまま返す", () => {
    const { env } = fakeEnv();
    expect(withSimulatedLatency(env)).toBe(env);
  });

  it("R2 の呼び出しが設定した時間だけ遅れ、結果は元のまま", async () => {
    const { env, calls } = fakeEnv({ SIM_R2_LATENCY_MS: "100" });
    const slow = withSimulatedLatency(env);
    let done = false;
    const p = slow.BUCKET.get("k").then((r) => {
      done = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(done).toBe(false);
    expect(calls).toEqual([]);
    await vi.advanceTimersByTimeAsync(2);
    expect(done).toBe(true);
    expect(calls).toEqual(["get:k"]);
    expect(await (await p)!.text()).toBe("v");
  });

  it("D1 は prepare → bind → run の実行時に遅れ、bind の引数は保たれる", async () => {
    const { env, calls } = fakeEnv({ SIM_D1_LATENCY_MS: "50" });
    const slow = withSimulatedLatency(env);
    const p = slow.DB.prepare("SELECT 1").bind("a", 2).run();
    expect(calls).toEqual(["bind:a,2"]);
    await vi.advanceTimersByTimeAsync(51);
    expect((await p).meta.changes).toBe(1);
    expect(calls).toEqual(["bind:a,2", "run:SELECT 1"]);
  });

  it("片方だけ設定したとき、もう片方は元のまま", () => {
    const { env, bucket } = fakeEnv({ SIM_D1_LATENCY_MS: "50" });
    const slow = withSimulatedLatency(env);
    expect(slow.BUCKET).toBe(bucket);
    expect(slow.DB).not.toBe(env.DB);
  });
});
