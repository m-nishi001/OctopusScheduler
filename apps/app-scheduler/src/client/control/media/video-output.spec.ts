import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { FakeSoundBackend } from "@octopus/client-common/audio/fake-sound-backend";
import { SoundSystem } from "@octopus/client-common/audio/sound-system";
import { VideoOutput } from "./video-output";

const video = () => ({}) as HTMLVideoElement;

function setup() {
  const backend = new FakeSoundBackend();
  const sound = new SoundSystem(backend);
  return { backend, sound, output: new VideoOutput(sound) };
}

describe("VideoOutput(動画の音を SoundSystem につなぐ)", () => {
  it("動画が出ていなければ、フェードはすぐ終わる", async () => {
    const { output } = setup();
    expect(output.active).toBe(false);
    await expect(output.fadeOut(2000)).resolves.toBeUndefined();
  });

  it("組み込んだ動画の音を、指定した時間をかけて下げる。下げ終えるまで解決しない", async () => {
    const { output, backend, sound } = setup();
    output.attach(video());
    expect(output.active).toBe(true);
    expect(sound.snapshot().video).toEqual({ gain: 1 });
    let done = false;
    void output.fadeOut(2000).then(() => (done = true));
    await Promise.resolve();
    expect(backend.calls).toContain("fadeOutElement:e1:fade=2000");
    expect(done).toBe(false);
    backend.finishElementFade("e1");
    await Promise.resolve();
    await Promise.resolve();
    expect(done).toBe(true);
    expect(sound.snapshot().video).toEqual({ gain: 0 });
  });

  it("0 秒なら、音量は触らず、すぐ終わる", async () => {
    const { output, backend } = setup();
    output.attach(video());
    await output.fadeOut(0);
    expect(backend.calls.some((c) => c.startsWith("fadeOutElement"))).toBe(false);
  });

  it("フェードの途中で外されたら(画面を離れた)、そこで終わる", async () => {
    const { output, sound } = setup();
    output.attach(video());
    const fading = output.fadeOut(5000);
    output.detach();
    await expect(fading).resolves.toBeUndefined();
    expect(output.active).toBe(false);
    expect(sound.snapshot().video).toBeNull();
  });

  it("別の動画に替わったら、前の動画は外す(同時に1つだけ)", () => {
    const { output, backend } = setup();
    output.attach(video());
    output.attach(video());
    expect(backend.calls.filter((c) => c.startsWith("attachElement"))).toEqual(["attachElement:e1", "attachElement:e2"]);
    expect(backend.calls).toContain("detachElement:e1");
  });

  it("動画を出すとき、自動再生の制限の解除を試みる", () => {
    const { output, backend } = setup();
    output.attach(video());
    expect(backend.calls).toContain("unlock");
  });
});
