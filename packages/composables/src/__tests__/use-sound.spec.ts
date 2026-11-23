import { createApp } from "vue";
import { describe, expect, it } from "vitest";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { SOUND_KEY, useSound } from "../use-sound";

describe("useSound", () => {
  it("app.provide した SoundSystem を取り出す", () => {
    const sound = new SoundSystem(new FakeSoundBackend());
    const app = createApp({});
    app.provide(SOUND_KEY, sound);
    expect(app.runWithContext(() => useSound())).toBe(sound);
  });

  it("提供されていなければ、分かる言葉の例外にする", () => {
    const app = createApp({});
    expect(() => app.runWithContext(() => useSound())).toThrow(/SOUND_KEY/);
  });
});
