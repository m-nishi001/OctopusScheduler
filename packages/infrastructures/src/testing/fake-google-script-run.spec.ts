import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GasFunctionService } from "@octopus/client-common/google-apps-script/gas-script-service";
import { installFakeGas, type FakeGas } from "./fake-google-script-run";

const ok = (data: unknown) => JSON.stringify({ status: "success", data });

describe("GasFunctionService + fake google.script.run", () => {
  let gas: FakeGas;
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    gas?.uninstall();
    vi.useRealTimers();
  });

  it("成功応答のデータを返す", async () => {
    gas = installFakeGas({ ping: () => ok("pong") });
    const p = new GasFunctionService("ping").call<string>();
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("pong");
  });

  it("retryable:false の応答は再試行せず即座に失敗する", async () => {
    gas = installFakeGas({
      submit: () => JSON.stringify({ status: "error", message: "closed", retryable: false }),
    });
    const p = new GasFunctionService("submit").call();
    const assertion = expect(p).rejects.toThrow("closed");
    await vi.runAllTimersAsync();
    await assertion;
    expect(gas.calls).toHaveLength(1);
  });

  it("retryable 指定のないエラーは retries 回まで再試行する", async () => {
    gas = installFakeGas({ flaky: () => JSON.stringify({ status: "error", message: "boom" }) });
    const p = new GasFunctionService("flaky", { retries: 2, retryDelay: 10 }).call();
    const assertion = expect(p).rejects.toThrow("boom");
    await vi.runAllTimersAsync();
    await assertion;
    expect(gas.calls).toHaveLength(3);
  });

  it("再試行で成功すればその結果を返す", async () => {
    let n = 0;
    gas = installFakeGas({
      flaky: () => (++n < 3 ? JSON.stringify({ status: "error", message: "x" }) : ok("done")),
    });
    const p = new GasFunctionService("flaky", { retries: 3, retryDelay: 10 }).call<string>();
    await vi.runAllTimersAsync();
    await expect(p).resolves.toBe("done");
  });

  it("同時実行数超過(呼び出し過多)は待って再試行し、空けば成功する", async () => {
    gas = installFakeGas({ slow: () => ok("fine") }, { latencyMs: 100, maxConcurrent: 1 });
    const a = new GasFunctionService("slow", { retryDelay: 50 }).call<string>();
    const b = new GasFunctionService("slow", { retryDelay: 50 }).call<string>();
    await vi.runAllTimersAsync();
    await expect(Promise.all([a, b])).resolves.toEqual(["fine", "fine"]);
    expect(gas.calls.some((c) => c.outcome === "throttled")).toBe(true);
  });

  it("呼び出し過多が続いても経過時間の上限(30秒)で打ち切る", async () => {
    gas = installFakeGas({ slow: () => ok("never") }, { maxConcurrent: 0 });
    const p = new GasFunctionService("slow", { retries: 0, retryDelay: 1000 }).call();
    const assertion = expect(p).rejects.toThrow("Service invoked too many times");
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    // 1秒間隔なので高々31回程度(上限100回に達する前に時間で止まる)
    expect(gas.calls.length).toBeLessThanOrEqual(35);
    expect(gas.calls.length).toBeGreaterThan(20);
  });

  it("応答が来なければ timeout でエラーにする", async () => {
    gas = installFakeGas({ hang: () => new Promise<string>(() => {}) });
    const p = new GasFunctionService("hang", { timeout: 500, retries: 0 }).call();
    const assertion = expect(p).rejects.toThrow("タイムアウト");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("サーバが非JSONを返してもパースエラーとして失敗する", async () => {
    gas = installFakeGas({ bad: () => "<html>oops</html>" });
    const p = new GasFunctionService("bad", { retries: 0 }).call();
    const assertion = expect(p).rejects.toThrow("応答のパースに失敗");
    await vi.runAllTimersAsync();
    await assertion;
  });
});
