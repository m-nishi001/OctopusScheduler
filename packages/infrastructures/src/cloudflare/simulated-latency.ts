import type { CloudflareEnv } from "./env";

/**
 * ローカル(wrangler dev --local)の負荷テスト用に、R2 / D1 の呼び出しへ遅延を足す。
 *
 * ローカルの R2 / D1 はファイル / SQLite への即時アクセスで、本番(ネットワーク越し)より桁違いに速い。
 * そのためロック保持が長引いて起きる順番待ちのような問題がローカルでは見えない。
 * 本番に近い遅延を足して、その種の問題をローカルでも再現できるようにする。
 *
 * 環境変数 `SIM_R2_LATENCY_MS` / `SIM_D1_LATENCY_MS`(1回の呼び出しあたりの平均ミリ秒)が
 * 設定されたときだけ有効。本番・staging では設定しないので何も起きない。
 */

/** 呼び出しごとのばらつき(平均の ±これだけの割合)。 */
const JITTER_RATIO = 0.4;
/** まれに遅い呼び出し(本番でも時々ある裾野)の確率と倍率。 */
const TAIL_PROBABILITY = 0.02;
const TAIL_MULTIPLIER = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 平均 meanMs の遅延を1回ぶん得る。 */
export function sampleLatencyMs(meanMs: number, random: () => number = Math.random): number {
  if (meanMs <= 0) return 0;
  const jittered = meanMs * (1 - JITTER_RATIO + 2 * JITTER_RATIO * random());
  return random() < TAIL_PROBABILITY ? jittered * TAIL_MULTIPLIER : jittered;
}

/** 環境変数の値(文字列)を平均ミリ秒に直す。未設定・不正・0以下は 0(遅延なし)。 */
export function parseLatencyMs(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : 0;
  return Number.isFinite(n) && n > 0 ? n : 0;
}

type AsyncMethod = (...args: unknown[]) => Promise<unknown>;

/** 指定したメソッドを、呼ぶ前に遅延を入れるようにした Proxy を返す。 */
function delayMethods<T extends object>(target: T, methods: ReadonlySet<string>, meanMs: number): T {
  return new Proxy(target, {
    get(obj, prop) {
      const value = Reflect.get(obj, prop, obj);
      if (typeof prop === "string" && methods.has(prop) && typeof value === "function") {
        return async (...args: unknown[]) => {
          await sleep(sampleLatencyMs(meanMs));
          return (value as AsyncMethod).apply(obj, args);
        };
      }
      return typeof value === "function" ? value.bind(obj) : value;
    },
  });
}

const R2_METHODS: ReadonlySet<string> = new Set(["get", "put", "delete", "head", "list"]);
const D1_STATEMENT_METHODS: ReadonlySet<string> = new Set(["run", "first", "all", "raw"]);

function delayD1Statement(statement: D1PreparedStatement, meanMs: number): D1PreparedStatement {
  const delayed = delayMethods(statement, D1_STATEMENT_METHODS, meanMs);
  return new Proxy(delayed, {
    get(obj, prop) {
      // bind() は新しい文を返すので、そちらにも遅延をかけ直す。
      if (prop === "bind") return (...args: unknown[]) => delayD1Statement(statement.bind(...args), meanMs);
      return Reflect.get(obj, prop, obj);
    },
  });
}

function delayD1(db: D1Database, meanMs: number): D1Database {
  return new Proxy(db, {
    get(obj, prop) {
      if (prop === "prepare") return (sql: string) => delayD1Statement(obj.prepare(sql), meanMs);
      if (prop === "batch" || prop === "exec") {
        return async (...args: unknown[]) => {
          await sleep(sampleLatencyMs(meanMs));
          return (Reflect.get(obj, prop, obj) as AsyncMethod).apply(obj, args);
        };
      }
      const value = Reflect.get(obj, prop, obj);
      return typeof value === "function" ? value.bind(obj) : value;
    },
  });
}

/** 環境変数が設定されていれば、R2 / D1 に遅延を足した env を返す。なければ元の env をそのまま返す。 */
export function withSimulatedLatency(env: CloudflareEnv): CloudflareEnv {
  const r2Ms = parseLatencyMs(env.SIM_R2_LATENCY_MS);
  const d1Ms = parseLatencyMs(env.SIM_D1_LATENCY_MS);
  if (!r2Ms && !d1Ms) return env;
  return {
    ...env,
    BUCKET: r2Ms ? delayMethods(env.BUCKET, R2_METHODS, r2Ms) : env.BUCKET,
    DB: d1Ms ? delayD1(env.DB, d1Ms) : env.DB,
  };
}
