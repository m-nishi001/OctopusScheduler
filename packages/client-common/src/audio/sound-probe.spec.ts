import { describe, expect, it } from "vitest";
import { FakeSoundBackend } from "./fake-sound-backend";
import { exposeSoundProbe } from "./sound-probe";
import { SoundSystem } from "./sound-system";

describe("exposeSoundProbe", () => {
    it("自動操作のブラウザのときだけ、状態を読める窓口を付ける", async () => {
        const sound = new SoundSystem(new FakeSoundBackend());
        const normal: Record<string, unknown> = {};
        expect(exposeSoundProbe(sound, { webdriver: false, target: normal })).toBe(false);
        expect(normal).toEqual({});

        const automated: Record<string, unknown> = {};
        expect(exposeSoundProbe(sound, { webdriver: true, target: automated })).toBe(true);
        await sound.screen.play({ key: "a", load: async () => new Blob() });
        const probe = automated.__sound as { snapshot: () => ReturnType<SoundSystem["snapshot"]> };
        expect(probe.snapshot().screen.current).toBe("a");
    });
});
