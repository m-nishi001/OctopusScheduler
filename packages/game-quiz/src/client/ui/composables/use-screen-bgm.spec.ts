import { describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";

const audio = vi.hoisted(() => ({ load: vi.fn().mockResolvedValue(undefined), play: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@octopus/composables", () => ({ useAudio: () => audio }));

import { useScreenBgm } from "./use-screen-bgm";

describe("useScreenBgm", () => {
  it("曲を読み込んで1回だけ流す(ループ指定なし)。曲が無ければ何もしない", async () => {
    vi.clearAllMocks();
    const blob = new Blob(["x"]);
    await effectScope().run(() => useScreenBgm())!.playOnce(blob);
    expect(audio.load).toHaveBeenCalledWith(blob);
    expect(audio.play).toHaveBeenCalledWith();

    vi.clearAllMocks();
    await effectScope().run(() => useScreenBgm())!.playOnce(null);
    expect(audio.load).not.toHaveBeenCalled();
  });

  it("再生が終わらなくても待たない。読み込みの途中で画面を離れたら鳴らさない", async () => {
    vi.clearAllMocks();
    audio.play.mockImplementationOnce(() => new Promise(() => {}));
    await effectScope().run(() => useScreenBgm())!.playOnce(new Blob(["x"]));

    vi.clearAllMocks();
    const scope = effectScope();
    const bgm = scope.run(() => useScreenBgm())!;
    const pending = bgm.playOnce(new Blob(["x"]));
    scope.stop();
    await pending;
    expect(audio.play).not.toHaveBeenCalled();
  });
});
