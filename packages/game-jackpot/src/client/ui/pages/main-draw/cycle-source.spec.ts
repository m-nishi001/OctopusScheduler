import { describe, it, expect, vi } from "vitest";
import { CycleSource } from "./cycle-source";

const flush = async () => {
  for (let i = 0; i < 6; i++) await Promise.resolve();
};

function build(prepare: () => Promise<string>) {
  const refresh = vi.fn(async () => undefined);
  const prep = vi.fn(prepare);
  const discard = vi.fn();
  const onPrefetchError = vi.fn();
  const source = new CycleSource<string>({ refresh, prepare: prep, discard, onPrefetchError });
  return { source, refresh, prepare: prep, discard, onPrefetchError };
}

describe("CycleSource", () => {
  it("先読みが無ければ、その場で読み直して用意する(従来どおり)", async () => {
    const { source, refresh, prepare } = build(async () => "sync");
    expect(await source.next()).toBe("sync");
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("先読みが済んでいれば、押下では読み直しも抽選もせず、すぐ返す。受け取ると空に戻る", async () => {
    const { source, refresh, prepare } = build(async () => "pre");
    source.prefetch("d1");
    await flush();
    expect(source.state.kind).toBe("ready");
    refresh.mockClear();
    prepare.mockClear();

    expect(await source.next()).toBe("pre");
    expect(refresh).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
    expect(source.state.kind).toBe("idle");
  });

  it("先読みは、読み直してから用意する。同じ drawId では1回だけ", async () => {
    const order: string[] = [];
    const refresh = vi.fn(async () => void order.push("refresh"));
    const prepare = vi.fn(async () => {
      order.push("prepare");
      return "x";
    });
    const source = new CycleSource<string>({ refresh, prepare, discard: vi.fn() });
    source.prefetch("d1");
    source.prefetch("d1");
    await flush();
    expect(order).toEqual(["refresh", "prepare"]);
  });

  it("先読みが失敗したら、onPrefetchError に伝え、押下ではその場で用意する(退行しない)", async () => {
    const impl = vi.fn().mockRejectedValueOnce(new Error("JACKPOT_CONFLICT")).mockResolvedValueOnce("sync");
    const { source, onPrefetchError, refresh } = build(impl);
    source.prefetch("d1");
    await flush();
    expect(onPrefetchError).toHaveBeenCalledTimes(1);
    expect(await source.next()).toBe("sync");
    expect(refresh).toHaveBeenCalledTimes(2); // 先読みの分 + その場の分
  });

  it("先読みの途中で押されたら待って使う。用意は1回だけ(二重に確定しない)", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const { source, prepare } = build(async () => {
      await gate;
      return "pre";
    });
    source.prefetch("d1");
    const taken = source.next();
    await flush();
    release();
    expect(await taken).toBe("pre");
    expect(prepare).toHaveBeenCalledTimes(1);
  });

  it("無効化すると、先読みしたものは捨てる(後始末)。次の押下はその場で用意する", async () => {
    const impl = vi.fn().mockResolvedValueOnce("stale").mockResolvedValueOnce("fresh");
    const { source, discard } = build(impl);
    source.prefetch("d1");
    await flush();
    source.invalidate();
    expect(discard).toHaveBeenCalledWith("stale");
    expect(await source.next()).toBe("fresh");
  });

  it("用意の最中に無効化したら、出来上がったものは捨てて、押下はその場で用意する", async () => {
    let release!: (v: string) => void;
    const first = new Promise<string>((r) => (release = r));
    const impl = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce("fresh");
    const { source, discard } = build(impl);
    source.prefetch("d1");
    source.invalidate();
    release("stale");
    await flush();
    expect(discard).toHaveBeenCalledWith("stale");
    expect(await source.next()).toBe("fresh");
  });

  it("次の抽選の公開で別の drawId の先読みを始めると、前の先読みは捨てる", async () => {
    const impl = vi.fn().mockResolvedValueOnce("for-d1").mockResolvedValueOnce("for-d2");
    const { source, discard } = build(impl);
    source.prefetch("d1");
    await flush();
    source.prefetch("d2");
    await flush();
    expect(discard).toHaveBeenCalledWith("for-d1");
    expect(await source.next()).toBe("for-d2");
  });

  it("その場の用意が失敗したら、そのまま例外にする(進行役が通知する)", async () => {
    const { source } = build(async () => {
      throw new Error("offline");
    });
    await expect(source.next()).rejects.toThrow("offline");
  });
});
