import { describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { SOUND_KEY } from "@octopus/composables/use-sound";
import { useScreenSound } from "./use-screen-sound";

function mountWith<T>(setup: () => T, sound: SoundSystem) {
  let result!: T;
  const app = createApp(defineComponent({ setup() { result = setup(); return () => h("div"); } }));
  app.provide(SOUND_KEY, sound);
  app.mount(document.createElement("div"));
  return result;
}
const blobOf = async () => new Blob(["x"]);

describe("useScreenSound", () => {
  it("曲をループで流し、stop は自分が流した曲だけを止める(同じチャンネルの別の曲は止めない)", async () => {
    const backend = new FakeSoundBackend();
    const sound = new SoundSystem(backend);
    const demo = mountWith(() => useScreenSound(blobOf), sound);
    await demo.play("demo.wav");
    expect(sound.screen.state.tracks).toMatchObject([{ key: "demo.wav", loop: true, status: "playing" }]);

    await demo.stop();
    expect(sound.screen.state.tracks).toEqual([]);

    // 抽選BGM(別の曲)が鳴っているときに stop しても、止めない
    await demo.play("demo.wav");
    await sound.screen.play({ key: "lottery.wav", load: blobOf });
    await demo.stop(); // demo は、lottery に置き換えられて、もう無い
    expect(sound.screen.state.tracks).toMatchObject([{ key: "lottery.wav" }]);
    await demo.stop();
    expect(sound.screen.state.tracks).toMatchObject([{ key: "lottery.wav" }]);
  });

  it("名前が空なら何もしない。流していないときの stop も何もしない。素材が無くても例外にしない", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const sound = new SoundSystem(new FakeSoundBackend());
    const s = mountWith(() => useScreenSound(async () => null), sound);
    await s.play("");
    await s.play(null);
    await s.stop();
    await expect(s.play("missing.wav")).resolves.toBeUndefined();
    expect(sound.screen.state.tracks).toEqual([]);
    vi.restoreAllMocks();
  });

  it("delayMs の間は鳴らさず、止めると鳴らさない", async () => {
    vi.useFakeTimers();
    const backend = new FakeSoundBackend();
    const sound = new SoundSystem(backend);
    const s = mountWith(() => useScreenSound(blobOf), sound);
    const playing = s.play("a.wav", 1200);
    await vi.advanceTimersByTimeAsync(500);
    expect(backend.playingIds).toEqual([]);
    await s.stop();
    await vi.advanceTimersByTimeAsync(2000);
    await playing;
    expect(backend.playingIds).toEqual([]);
    vi.useRealTimers();
  });
});
