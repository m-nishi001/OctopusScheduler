import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AudioControl } from "./audio";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  let n = 0;
  const audio = {
    loadFromBlob: vi.fn(async (_blob: Blob) => `inst-${++n}`),
    play: vi.fn(async (_id: string, _fadeMs?: number, _loop?: boolean) => undefined),
    pause: vi.fn(async (_id: string, _fadeMs?: number) => undefined),
    stop: vi.fn(async (_id: string, _fadeMs?: number) => undefined),
    disposeInstance: vi.fn((_id: string) => undefined),
  };
  const source = { ensure: vi.fn(async (id: string) => new Blob([id])) };
  return { audio, source, control: new AudioControl(source, audio) };
}

beforeEach(() => vi.spyOn(console, "error").mockImplementation(() => undefined));

describe("AudioControl", () => {
  it("素材を取ってから鳴らす", async () => {
    const { control, audio, source } = setup();
    await control.play("a");
    expect(source.ensure).toHaveBeenCalledWith("a");
    expect(audio.play).toHaveBeenCalledWith("inst-1", 0, false);
  });

  it("loop を指定すると、繰り返し再生で鳴らす", async () => {
    const { control, audio } = setup();
    await control.play("a", true);
    expect(audio.play).toHaveBeenCalledWith("inst-1", 0, true);
  });

  it("曲を指定した停止は、その曲だけをフェードアウトして止め、片づける", async () => {
    const { control, audio } = setup();
    await control.play("a");
    await control.play("b");
    await control.stop("a", 1.5);
    expect(audio.stop).toHaveBeenCalledOnce();
    expect(audio.stop).toHaveBeenCalledWith("inst-1", 1500);
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
  });

  it("曲を指定しない停止は、鳴っているすべてを止める", async () => {
    const { control, audio } = setup();
    await control.play("a");
    await control.play("b");
    await control.stop();
    expect(audio.stop.mock.calls.map((c) => c[0]).sort()).toEqual(["inst-1", "inst-2"]);
  });

  it("鳴っていない曲の停止は何もしない", async () => {
    const { control, audio } = setup();
    await control.stop("zzz");
    expect(audio.stop).not.toHaveBeenCalled();
  });

  it("取得を待っている間に停止が来たら、届いても鳴らさない", async () => {
    const { control, audio, source } = setup();
    const gate = deferred<Blob>();
    source.ensure.mockReturnValueOnce(gate.promise);
    const playing = control.play("a");
    await control.stop("a");
    gate.resolve(new Blob(["a"]));
    await playing;
    expect(audio.loadFromBlob).not.toHaveBeenCalled();
    expect(audio.play).not.toHaveBeenCalled();
  });

  it("取得を待っている間の全停止でも、鳴らさない。あとから出した別の曲は鳴る", async () => {
    const { control, audio, source } = setup();
    const gate = deferred<Blob>();
    source.ensure.mockReturnValueOnce(gate.promise);
    const first = control.play("a");
    await control.stop();
    await control.play("b");
    gate.resolve(new Blob(["a"]));
    await first;
    expect(audio.play).toHaveBeenCalledOnce();
  });

  it("読み込みの最中に停止が来たら、鳴らさずに片づける", async () => {
    const { control, audio } = setup();
    const gate = deferred<string>();
    audio.loadFromBlob.mockReturnValueOnce(gate.promise);
    const playing = control.play("a");
    await vi.waitFor(() => expect(audio.loadFromBlob).toHaveBeenCalled());
    await control.stop("a");
    gate.resolve("late");
    await playing;
    expect(audio.play).not.toHaveBeenCalled();
    expect(audio.disposeInstance).toHaveBeenCalledWith("late");
  });

  it("同じ曲をもう一度鳴らすと、前の分は止めて片づける(鳴りっぱなしの取り残しを作らない)", async () => {
    const { control, audio } = setup();
    await control.play("a");
    await control.play("a");
    expect(audio.stop).toHaveBeenCalledWith("inst-1", 0);
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
    expect(audio.play).toHaveBeenLastCalledWith("inst-2", 0, false);
  });

  it("止めるのに失敗しても片づけて、例外にしない", async () => {
    const { control, audio } = setup();
    await control.play("a");
    audio.stop.mockRejectedValueOnce(new Error("gone"));
    await expect(control.stop("a")).resolves.toBeUndefined();
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
  });

  describe("suspend / resume", () => {
    it("suspend は鳴っている曲をフェードアウトして一時停止し、破棄しない。resume は同じ再生を、loop も含めて続きから鳴らす", async () => {
      const { control, audio } = setup();
      await control.play("a", true);
      await control.play("b");
      await control.suspend(1);
      expect(audio.pause.mock.calls).toEqual([["inst-1", 1000], ["inst-2", 1000]]);
      expect(audio.disposeInstance).not.toHaveBeenCalled();
      expect(audio.stop).not.toHaveBeenCalled();
      audio.play.mockClear();
      await control.resume();
      expect(audio.play).toHaveBeenCalledWith("inst-1", 1000, true);
      expect(audio.play).toHaveBeenCalledWith("inst-2", 1000, false);
      expect(audio.loadFromBlob).toHaveBeenCalledTimes(2);
    });

    it("resume のあとの全停止は、再開した曲を止める。もう一度 resume しても何も鳴らない", async () => {
      const { control, audio } = setup();
      await control.play("a");
      await control.suspend();
      await control.resume();
      audio.play.mockClear();
      await control.stop();
      expect(audio.stop).toHaveBeenCalledWith("inst-1", 0);
      await control.resume();
      expect(audio.play).not.toHaveBeenCalled();
    });

    it("一時停止中に stop(id) が来た曲は破棄され、resume で戻らない。ほかの曲は戻る", async () => {
      const { control, audio } = setup();
      await control.play("a");
      await control.play("b");
      await control.suspend();
      await control.stop("a");
      expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
      audio.play.mockClear();
      await control.resume();
      expect(audio.play).toHaveBeenCalledOnce();
      expect(audio.play).toHaveBeenCalledWith("inst-2", 1000, false);
    });

    it("一時停止中の全停止は、すべて破棄する", async () => {
      const { control, audio } = setup();
      await control.play("a");
      await control.suspend();
      await control.stop();
      expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
      audio.play.mockClear();
      await control.resume();
      expect(audio.play).not.toHaveBeenCalled();
    });

    it("一時停止中に同じ曲が鳴らされていたら、resume は再開せずに古い方を破棄する(二重に鳴らさない)", async () => {
      const { control, audio } = setup();
      await control.play("a");
      await control.suspend();
      await control.play("a");
      audio.play.mockClear();
      await control.resume();
      expect(audio.play).not.toHaveBeenCalled();
      expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
    });

    it("鳴っていないときの suspend / resume は何もしない", async () => {
      const { control, audio } = setup();
      await control.suspend();
      await control.resume();
      expect(audio.pause).not.toHaveBeenCalled();
      expect(audio.play).not.toHaveBeenCalled();
    });

    it("一時停止に失敗しても例外にしない", async () => {
      const { control, audio } = setup();
      await control.play("a");
      audio.pause.mockRejectedValueOnce(new Error("gone"));
      await expect(control.suspend()).resolves.toBeUndefined();
    });
  });
});
