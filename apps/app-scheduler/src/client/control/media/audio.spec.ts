import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { AudioControl } from "./audio";

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  const backend = new FakeSoundBackend();
  const sound = new SoundSystem(backend);
  const source = { ensure: vi.fn(async (id: string) => new Blob([id])) };
  return { backend, sound, source, control: new AudioControl(source, sound) };
}

describe("AudioControl(venue チャンネルの薄い包み)", () => {
  it("素材を取ってから、1回だけ(ループなし)で鳴らす。loop を指定すると繰り返す", async () => {
    const { control, backend, source } = setup();
    await control.play("a");
    expect(source.ensure).toHaveBeenCalledWith("a");
    expect(backend.calls).toContain("play:i1:fadeIn=0:loop=false");
    await control.play("b", true);
    expect(backend.calls).toContain("play:i2:fadeIn=0:loop=true");
  });

  it("曲を指定した停止は、その曲だけをフェードアウトして止め、片づける", async () => {
    const { control, backend } = setup();
    await control.play("a");
    await control.play("b");
    await control.stop("a", 1.5);
    expect(backend.calls).toContain("stop:i1:fade=1500");
    expect(backend.calls).toContain("dispose:i1");
    expect(backend.alive).toEqual(["i2"]);
  });

  it("曲を指定しない停止は、鳴っているすべてを止める", async () => {
    const { control, backend } = setup();
    await control.play("a");
    await control.play("b");
    await control.stop();
    expect(backend.alive).toEqual([]);
  });

  it("鳴っていない曲の停止は何もしない", async () => {
    const { control, backend } = setup();
    await control.stop("zzz");
    expect(backend.calls).toEqual([]);
  });

  it("停止は、秒数を省かなければ既定の 2 秒でフェードし、0 を明示したときだけ即時に止める", async () => {
    const { control, backend } = setup();
    await control.play("a");
    await control.play("b");
    await control.stop("a");
    expect(backend.calls).toContain("stop:i1:fade=2000");
    await control.stop("b", 0);
    expect(backend.calls).toContain("stop:i2:fade=0");
  });

  it("取得を待っている間に停止が来たら、届いても鳴らさない", async () => {
    const { control, backend, source } = setup();
    const gate = deferred<Blob>();
    source.ensure.mockReturnValueOnce(gate.promise);
    const playing = control.play("a");
    await control.stop("a");
    gate.resolve(new Blob(["a"]));
    await playing;
    expect(backend.calls.filter((c) => c.startsWith("play:"))).toEqual([]);
    expect(backend.alive).toEqual([]);
  });

  it("取得を待っている間の全停止でも、鳴らさない。あとから出した別の曲は鳴る", async () => {
    const { control, backend, source } = setup();
    const gate = deferred<Blob>();
    source.ensure.mockReturnValueOnce(gate.promise);
    const first = control.play("a");
    await control.stop();
    await control.play("b");
    gate.resolve(new Blob(["a"]));
    await first;
    expect(control.snapshot()).toEqual([{ assetId: "b", loop: false }]);
    expect(backend.calls.filter((c) => c.startsWith("play:"))).toHaveLength(1);
  });

  it("読み込みの最中に停止が来たら、鳴らさずに片づける", async () => {
    const { control, backend } = setup();
    const gate = deferred<void>();
    backend.holdLoad = gate.promise;
    const playing = control.play("a");
    await vi.waitFor(() => expect(control.snapshot()).toEqual([]));
    await control.stop("a");
    gate.resolve();
    await playing;
    expect(backend.calls.filter((c) => c.startsWith("play:"))).toEqual([]);
    expect(backend.alive).toEqual([]);
  });

  it("同じ曲をもう一度鳴らすと、古い方を指定秒(既定 2 秒)でフェードアウトしながら新しい方を鳴らし、片づける(クロスフェード)", async () => {
    const { control, backend } = setup();
    await control.play("a");
    await control.play("a");
    expect(backend.calls).toContain("stop:i1:fade=2000");
    expect(backend.calls).toContain("play:i2:fadeIn=0:loop=false");
    await vi.waitFor(() => expect(backend.alive).toEqual(["i2"]));
    await control.play("a", false, 3);
    expect(backend.calls).toContain("stop:i2:fade=3000");
  });

  it("素材を取れなかったときは、その例外で失敗する(管理端末に知らせるため)。一覧には残らない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { control, source } = setup();
    source.ensure.mockRejectedValueOnce(new Error("素材がサーバーにありません: gone1"));
    await expect(control.play("gone1")).rejects.toThrow("素材がサーバーにありません: gone1");
    expect(control.snapshot()).toEqual([]);
  });

  describe("ゲームの出入り(SoundSystem.enterGame / leaveGame)", () => {
    it("入ると鳴っている曲を1秒のフェードアウトで一時停止し(破棄しない)、出ると同じ再生を、loop も含めて1秒のフェードインで続きから鳴らす", async () => {
      const { control, backend, sound } = setup();
      await control.play("a", true);
      await control.play("b");
      await sound.enterGame();
      expect(backend.calls).toContain("pause:i1:fade=1000");
      expect(backend.calls).toContain("pause:i2:fade=1000");
      expect(backend.calls.some((c) => c.startsWith("stop:"))).toBe(false);
      expect(control.snapshot()).toEqual([]);
      await sound.leaveGame();
      expect(backend.calls).toContain("play:i1:fadeIn=1000:loop=true");
      expect(backend.calls).toContain("play:i2:fadeIn=1000:loop=false");
      expect(control.snapshot()).toEqual([{ assetId: "a", loop: true }, { assetId: "b", loop: false }]);
      expect(backend.calls.filter((c) => c.startsWith("load:"))).toHaveLength(2);
    });

    it("一時停止中の停止は破棄し、再開で戻らない", async () => {
      const { control, backend, sound } = setup();
      await control.play("a");
      await control.play("b");
      await sound.enterGame();
      await control.stop("a");
      expect(backend.calls).toContain("dispose:i1");
      await sound.leaveGame();
      expect(control.snapshot()).toEqual([{ assetId: "b", loop: false }]);
      await sound.enterGame();
      await control.stop();
      await sound.leaveGame();
      expect(control.snapshot()).toEqual([]);
    });

    it("鳴っていないときの入退場は何もしない", async () => {
      const { backend, sound } = setup();
      await sound.enterGame();
      await sound.leaveGame();
      expect(backend.calls).toEqual([]);
    });
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

  it("subscribe は、鳴っている曲が変わったときに知らせ、解除できる", async () => {
    const { control } = setup();
    const listener = vi.fn();
    const off = control.subscribe(listener);
    await control.play("a");
    const afterPlay = listener.mock.calls.length;
    expect(afterPlay).toBeGreaterThan(0);
    await control.stop("a", 0);
    const afterStop = listener.mock.calls.length;
    expect(afterStop).toBeGreaterThan(afterPlay);
    await control.stop("a", 0); // 鳴っていない曲の停止は、変化ではない
    expect(listener).toHaveBeenCalledTimes(afterStop);
    off();
    await control.play("b");
    expect(listener).toHaveBeenCalledTimes(afterStop);
  });

  it("曲が自然に終わったら、鳴っている曲から消し、知らせて、片づける", async () => {
    const { control, backend } = setup();
    await control.play("a");
    const listener = vi.fn();
    control.subscribe(listener);
    backend.end("i1");
    expect(control.snapshot()).toEqual([]);
    expect(listener).toHaveBeenCalledOnce();
    expect(backend.alive).toEqual([]);
  });

  it("止めたあと・再生し直したあとに届いた、古い再生の終了は、新しい再生を消さない", async () => {
    const { control, backend } = setup();
    await control.play("a");
    await control.play("a"); // クロスフェードで入れ替え
    await vi.waitFor(() => expect(backend.alive).toEqual(["i2"]));
    expect(control.snapshot()).toEqual([{ assetId: "a", loop: false }]);
  });

  it("鳴らせなかった曲は、一覧に残さない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { control, backend } = setup();
    backend.failPlay = true;
    await control.play("a");
    await vi.waitFor(() => expect(control.snapshot()).toEqual([]));
    expect(backend.alive).toEqual([]);
  });
});
