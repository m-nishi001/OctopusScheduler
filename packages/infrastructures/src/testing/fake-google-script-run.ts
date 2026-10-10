/**
 * テスト用の `google.script.run` フェイク。
 *
 * GasFunctionService(クライアント側のGAS呼び出し)が実際に叩く
 * `withSuccessHandler / withFailureHandler / <関数名>(args)` の連鎖を再現し、
 * 遅延・失敗・同時実行数超過(「Service invoked too many times」)を注入できる。
 * GAS実機の挙動そのものの再現ではない(実機はスモークテストで確認する)。
 */
export type FakeGasHandler = (args: unknown) => string | Promise<string>;

export interface FakeGasOptions {
  /** 各呼び出しの応答までの遅延(ms)。fake timers と併用する。 */
  latencyMs?: number;
  /** 同時に処理中にできる呼び出し数。超えた呼び出しは「呼び出し過多」で失敗する。 */
  maxConcurrent?: number;
}

export interface FakeGas {
  /** 呼び出しの記録(関数名・引数・結果)。 */
  readonly calls: Array<{ name: string; args: unknown; outcome: "success" | "failure" | "throttled" }>;
  setHandler(name: string, handler: FakeGasHandler): void;
  setOptions(options: FakeGasOptions): void;
  uninstall(): void;
}

export const THROTTLE_MESSAGE = "Service invoked too many times in a short time";

export function installFakeGas(
  handlers: Record<string, FakeGasHandler> = {},
  initial: FakeGasOptions = {}
): FakeGas {
  const table = new Map(Object.entries(handlers));
  let options = { ...initial };
  let inFlight = 0;
  const calls: FakeGas["calls"] = [];

  const invoke = (
    name: string,
    args: unknown,
    onSuccess: (value: string) => void,
    onFailure: (error: Error) => void
  ) => {
    if (options.maxConcurrent !== undefined && inFlight >= options.maxConcurrent) {
      calls.push({ name, args, outcome: "throttled" });
      setTimeout(() => onFailure(new Error(THROTTLE_MESSAGE)), 0);
      return;
    }
    inFlight++;
    setTimeout(async () => {
      try {
        const handler = table.get(name);
        if (!handler) throw new Error(`${name} is not a function`);
        const value = await handler(args);
        calls.push({ name, args, outcome: "success" });
        onSuccess(value);
      } catch (error) {
        calls.push({ name, args, outcome: "failure" });
        onFailure(error instanceof Error ? error : new Error(String(error)));
      } finally {
        inFlight--;
      }
    }, options.latencyMs ?? 0);
  };

  const makeRun = (
    onSuccess: (value: string) => void,
    onFailure: (error: Error) => void
  ): unknown =>
    new Proxy(
      {},
      {
        get(_target, prop: string) {
          if (prop === "withSuccessHandler") return (h: (v: string) => void) => makeRun(h, onFailure);
          if (prop === "withFailureHandler") return (h: (e: Error) => void) => makeRun(onSuccess, h);
          return (args: unknown) => invoke(prop, args, onSuccess, onFailure);
        },
      }
    );

  const g = globalThis as unknown as { google?: unknown };
  const previous = g.google;
  g.google = { script: { run: makeRun(() => {}, () => {}) } };

  return {
    calls,
    setHandler: (name, handler) => void table.set(name, handler),
    setOptions: (next) => void (options = { ...next }),
    uninstall: () => {
      g.google = previous;
    },
  };
}
