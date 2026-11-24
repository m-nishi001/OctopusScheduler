import { describe, expect, it } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { installQuizBgmGuard, isQuizScreenPath } from "./quiz-bgm-guard";

describe("isQuizScreenPath", () => {
  it.each([
    ["/execute/quiz/q1/intro", true],
    ["/execute/quiz/q1/play", true],
    ["/execute/quiz/q1/answer", true],
    ["/execute/quiz/q1/result", true],
    ["/execute/quiz/q1/result/preview", true],
    ["/execute/quiz/q1/play?x=1", true],
    ["/execute/quiz/q1/entry", false],
    ["/execute/jackpot-opening", false],
    ["/session/host/s1", false],
    ["/quiz-admin", false],
  ])("%s → %s", (path, expected) => expect(isQuizScreenPath(path)).toBe(expected));
});

describe("installQuizBgmGuard", () => {
  const Empty = { render: () => null };
  const paths = ["/execute/quiz/q1/intro", "/execute/quiz/q1/play", "/session/host/s1", "/execute/jackpot-opening", "/home"];
  const setup = () => {
    const backend = new FakeSoundBackend();
    const sound = new SoundSystem(backend);
    const router = createRouter({ history: createMemoryHistory(), routes: paths.map((path) => ({ path, component: Empty })) });
    installQuizBgmGuard(router, sound);
    return { backend, sound, router };
  };
  const song = (key: string) => ({ key, load: async () => new Blob(["x"]) });

  it("クイズの画面から出る・クイズの画面へ入る・クイズの画面どうしで移るとき、画面の曲を止める", async () => {
    const { router, sound } = setup();
    await router.push("/execute/quiz/q1/intro");
    await sound.screen.play(song("quiz:q1:intro"));
    await router.push("/execute/quiz/q1/play");
    expect(sound.screen.state.tracks).toEqual([]);

    await sound.screen.play(song("quiz:q1:play"), { loop: true });
    await router.push("/session/host/s1");
    expect(sound.screen.state.tracks).toEqual([]);

    await router.push("/home");
    await sound.screen.play(song("left-over"));
    await router.push("/execute/quiz/q1/intro");
    expect(sound.screen.state.tracks).toEqual([]);
  });

  it("クイズに関係しない遷移では、画面の曲(ジャックポットなど)を止めない", async () => {
    const { router, sound } = setup();
    await router.push("/home");
    await sound.screen.play(song("jackpot-bgm"));
    await router.push("/execute/jackpot-opening");
    expect(sound.screen.state.tracks).toHaveLength(1);
  });
});
