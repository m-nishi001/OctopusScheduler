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
    play: vi.fn(async (_id: string, _fadeMs?: number, _loop?: boolean, _onEnded?: () => void) => undefined),
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
    expect(audio.play).toHaveBeenCalledWith("inst-1", 0, false, expect.any(Function));
  });

  it("loop を指定すると、繰り返し再生で鳴らす", async () => {
    const { control, audio } = setup();
    await control.play("a", true);
    expect(audio.play).toHaveBeenCalledWith("inst-1", 0, true, expect.any(Function));
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
    expect(audio.stop).toHaveBeenCalledWith("inst-1", 2000);
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
    expect(audio.play).toHaveBeenLastCalledWith("inst-2", 0, false, expect.any(Function));
  });

  it("同じ曲の再生し直しは、古い方の停止の完了を待たずに、新しい方を鳴らす(クロスフェード)。秒数は指定できる", async () => {
    const { control, audio } = setup();
    await control.play("a");
    const fading = deferred<undefined>();
    audio.stop.mockReturnValueOnce(fading.promise);
    await control.play("a", false, 3);
    expect(audio.stop).toHaveBeenCalledWith("inst-1", 3000);
    expect(audio.play).toHaveBeenLastCalledWith("inst-2", 0, false, expect.any(Function));
    expect(audio.disposeInstance).not.toHaveBeenCalledWith("inst-1"); // まだフェードアウト中
    fading.resolve(undefined);
    await vi.waitFor(() => expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1"));
  });

  it("停止は、秒数を省かなければ既定の 2 秒でフェードし、0 を明示したときだけ即時に止める", async () => {
    const { control, audio } = setup();
    await control.play("a");
    await control.play("b");
    await control.stop("a");
    expect(audio.stop).toHaveBeenLastCalledWith("inst-1", 2000);
    await control.stop("b", 0);
    expect(audio.stop).toHaveBeenLastCalledWith("inst-2", 0);
  });

  it("止めるのに失敗しても片づけて、例外にしない", async () => {
    const { control, audio } = setup();
    await control.play("a");
    audio.stop.mockRejectedValueOnce(new Error("gone"));
    await expect(control.stop("a")).resolves.toBeUndefined();
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
  });
});

describe("AudioControl: いま鳴っている曲", () => {
  it("snapshot は、鳴らした順に、素材 ID とループかを返す。止めた曲は消える", async () => {
    const { control } = setup();
    expect(control.snapshot()).toEqual([]);
    await control.play("a");
    await control.play("b", true);
    expect(control.snapshot()).toEqual([
      { assetId: "a", loop: false },
      { assetId: "b", loop: true },
    ]);
    await control.stop("a");
    expect(control.snapshot()).toEqual([{ assetId: "b", loop: true }]);
    await control.stop();
    expect(control.snapshot()).toEqual([]);
  });

  it("subscribe は、鳴っている曲が変わるたびに知らせ、解除できる", async () => {
    const { control } = setup();
    const listener = vi.fn();
    const off = control.subscribe(listener);
    await control.play("a");
    expect(listener).toHaveBeenCalledTimes(1);
    await control.stop("a");
    expect(listener).toHaveBeenCalledTimes(2);
    await control.stop("a"); // 鳴っていない曲の停止は、変化ではない
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    await control.play("b");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("曲が自然に終わったら、鳴っている曲から消し、知らせて、片づける", async () => {
    const { control, audio } = setup();
    await control.play("a");
    const listener = vi.fn();
    control.subscribe(listener);
    const onEnded = audio.play.mock.calls[0][3]!;
    onEnded();
    expect(control.snapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
    onEnded(); // 二重の通知は無視する
    expect(listener).toHaveBeenCalledOnce();
  });

  it("止めたあと・再生し直したあとに届いた、古い再生の終了は無視する", async () => {
    const { control, audio } = setup();
    await control.play("a");
    const oldEnded = audio.play.mock.calls[0][3]!;
    await control.play("a"); // クロスフェードで入れ替え
    oldEnded();
    expect(control.snapshot()).toEqual([{ assetId: "a", loop: false }]);
    expect(audio.disposeInstance).toHaveBeenCalledTimes(1); // 古い方は、フェード後の片づけの1回だけ
  });

  it("鳴らせなかった曲は、一覧に残さない", async () => {
    const { control, audio } = setup();
    audio.play.mockRejectedValueOnce(new Error("boom"));
    await expect(control.play("a")).rejects.toThrow("boom");
    expect(control.snapshot()).toEqual([]);
    expect(audio.disposeInstance).toHaveBeenCalledWith("inst-1");
  });
});
