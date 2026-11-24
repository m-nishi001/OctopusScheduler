import { describe, expect, it } from "vitest";
import { createApp, defineComponent, h } from "vue";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { SOUND_KEY } from "@octopus/composables/use-sound";
import { useQuizSound } from "./use-quiz-sound";

function mountWith<T>(setup: () => T, sound: SoundSystem) {
  let result!: T;
  const app = createApp(defineComponent({ setup() { result = setup(); return () => h("div"); } }));
  app.provide(SOUND_KEY, sound);
  app.mount(document.createElement("div"));
  return { result, unmount: () => app.unmount() };
}
const blob = () => new Blob(["x"]);

describe("useQuizSound", () => {
  it("曲を1回だけ流し(既定)、loop 指定ならループで流す。曲が無ければ何もしない", async () => {
    const backend = new FakeSoundBackend();
    const sound = new SoundSystem(backend);
    const { result: q } = mountWith(() => useQuizSound(), sound);
    await q.play("quiz:a:intro", null);
    await q.play("quiz:a:intro", undefined);
    expect(sound.screen.state.tracks).toEqual([]);

    await q.play("quiz:a:intro", blob());
    expect(sound.screen.state.tracks).toMatchObject([{ key: "quiz:a:intro", loop: false, status: "playing" }]);
    await q.play("quiz:a:play", blob(), { loop: true });
    expect(sound.screen.state.tracks).toMatchObject([{ key: "quiz:a:play", loop: true }]); // 別の曲は置き換える
  });

  it("stop は自分が流した曲だけを止める。流していなければ何もしない", async () => {
    const backend = new FakeSoundBackend();
    const sound = new SoundSystem(backend);
    const { result: q } = mountWith(() => useQuizSound(), sound);
    await q.stop();
    await q.play("quiz:a:ranking", blob());
    await sound.screen.play({ key: "other", load: async () => blob() }); // 別の曲に置き換わる
    await q.stop();
    expect(sound.screen.state.tracks).toMatchObject([{ key: "other" }]);
  });

  it("画面を離れたあとに届いた曲は、鳴らさない", async () => {
    const backend = new FakeSoundBackend();
    const sound = new SoundSystem(backend);
    const { result: q, unmount } = mountWith(() => useQuizSound(), sound);
    unmount();
    await q.play("quiz:a:intro", blob());
    expect(backend.playingIds).toEqual([]);
  });
});
