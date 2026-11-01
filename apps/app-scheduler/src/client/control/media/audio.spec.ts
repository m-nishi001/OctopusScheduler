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
    play: vi.fn(async (_id: string) => undefined),
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
    expect(audio.play).toHaveBeenCalledWith("inst-1");
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
    expect(audio.play).toHaveBeenLastCalledWith("inst-2");
  });

  it("止めるのに失敗しても片づけて、例外にしない", async () => {
    const { control, audio } = setup();
    await control.play("a");
    audio.stop.mockRejectedValueOnce(new Error("gone"));
    await expect(control.stop("a")).resolves.toBeUndefined();
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
  });
});
