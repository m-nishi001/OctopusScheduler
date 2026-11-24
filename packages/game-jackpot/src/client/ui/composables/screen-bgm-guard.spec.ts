import { describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { installScreenBgmGuard } from "./screen-bgm-guard";

const Empty = { render: () => null };
const paths = ["/execute/jackpot-opening", "/execute/jackpot-description", "/execute/jackpot-demo-draw", "/execute/jackpot-draw", "/execute/jackpot-result", "/execute/jackpot-admin/screens/opening", "/execute/quiz/q1/intro", "/home"];

function setup(bgms: Record<string, string | undefined>) {
  const backend = new FakeSoundBackend();
  const sound = new SoundSystem(backend);
  const router = createRouter({ history: createMemoryHistory(), routes: paths.map((path) => ({ path, component: Empty })) });
  const load = vi.fn(async (screen: string) => (bgms[screen] ? (screen === "result" ? { resultBgm: bgms[screen] } : { bgm: bgms[screen] }) : null));
  installScreenBgmGuard(router, sound, load);
  const song = (key: string) => ({ key, load: async () => new Blob(["x"]) });
  return { router, sound, backend, load, song };
}

describe("installScreenBgmGuard", () => {
  it("同じ曲の画面へ移るときは、流し続ける(止めない)", async () => {
    const { router, sound, backend, song } = setup({ opening: "a.wav", description: "a.wav" });
    await router.push("/execute/jackpot-opening");
    await sound.screen.play(song("a.wav"), { loop: true });
    const id = backend.playingIds[0];
    await router.push("/execute/jackpot-description");
    expect(backend.playingIds).toEqual([id]);
    expect(await sound.screen.play(song("a.wav"), { loop: true })).toBe("kept");
  });

  it("違う曲の画面・曲の無い画面・ほかの画面へ移るときは、止める", async () => {
    const { router, sound, backend, song } = setup({ opening: "a.wav", description: "b.wav", "demo-draw": undefined });
    await router.push("/execute/jackpot-opening");
    await sound.screen.play(song("a.wav"));
    await router.push("/execute/jackpot-description");
    expect(sound.screen.state.tracks).toEqual([]);
    expect(backend.playingIds).toEqual([]);

    await sound.screen.play(song("b.wav"));
    await router.push("/execute/jackpot-demo-draw"); // 曲の設定が無い
    expect(sound.screen.state.tracks).toEqual([]);

    await sound.screen.play(song("c.wav"));
    await router.push("/execute/jackpot-draw"); // BGM を持たない画面へ
    expect(sound.screen.state.tracks).toEqual([]);
  });

  it("読み込み中の別の曲も、止める(あとから鳴り出さない)", async () => {
    const { router, sound, backend, song } = setup({ opening: "a.wav", description: "b.wav" });
    await router.push("/execute/jackpot-opening");
    let release: () => void = () => undefined;
    backend.holdLoad = new Promise<void>((resolve) => (release = resolve));
    const pending = sound.screen.play(song("a.wav"));
    await router.push("/execute/jackpot-description");
    release();
    expect(await pending).toBe("cancelled");
    expect(backend.playingIds).toEqual([]);
  });

  it("ジャックポットの画面に関係しない遷移では、何も読まず、画面の曲(クイズなど)も止めない", async () => {
    const { router, sound, backend, song, load } = setup({});
    await router.push("/home");
    await sound.screen.play(song("quiz.wav"));
    await router.push("/execute/quiz/q1/intro");
    await router.push("/execute/jackpot-admin/screens/opening");
    expect(load).not.toHaveBeenCalled();
    expect(backend.playingIds).toHaveLength(1);
  });

  it("設定を読めなくても、遷移は進み、曲は止める", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { router, sound, song, load } = setup({});
    load.mockRejectedValue(new Error("db down"));
    await router.push("/home");
    await sound.screen.play(song("a.wav"));
    await router.push("/execute/jackpot-result");
    expect(router.currentRoute.value.path).toBe("/execute/jackpot-result");
    expect(sound.screen.state.tracks).toEqual([]);
    vi.restoreAllMocks();
  });

  it("設定の読み込みが遅くても、遷移は待たされない(止めずに進む)", async () => {
    vi.useFakeTimers();
    const { router, sound, backend, song, load } = setup({});
    load.mockImplementation(() => new Promise(() => undefined));
    await router.push("/home");
    await sound.screen.play(song("a.wav"));
    const moving = router.push("/execute/jackpot-description");
    await vi.advanceTimersByTimeAsync(1600);
    await moving;
    expect(router.currentRoute.value.path).toBe("/execute/jackpot-description");
    expect(backend.playingIds).toHaveLength(1); // 止めていない(行き先の画面が play で決める)
    vi.useRealTimers();
  });
});
