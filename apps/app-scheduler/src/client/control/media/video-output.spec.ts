import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VideoOutput } from "./video-output";

const fakeVideo = () => ({ volume: 1 }) as HTMLVideoElement;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("VideoOutput", () => {
  it("動画が出ていなければ、フェードはすぐ終わる", async () => {
    const output = new VideoOutput();
    expect(output.active).toBe(false);
    await expect(output.fadeOut(2000)).resolves.toBeUndefined();
  });

  it("指定した時間をかけて、いまの音量から 0 まで下げる", async () => {
    const output = new VideoOutput();
    const video = fakeVideo();
    video.volume = 0.8;
    output.attach(video);
    expect(output.active).toBe(true);
    let done = false;
    void output.fadeOut(2000).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(1000);
    expect(video.volume).toBeCloseTo(0.4, 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(video.volume).toBe(0);
    expect(done).toBe(true);
  });

  it("0 秒なら、音量は触らず、すぐ終わる", async () => {
    const output = new VideoOutput();
    const video = fakeVideo();
    output.attach(video);
    await output.fadeOut(0);
    expect(video.volume).toBe(1);
  });

  it("フェードの途中で外されたら(画面を離れた)、そこで終わる", async () => {
    const output = new VideoOutput();
    output.attach(fakeVideo());
    const fading = output.fadeOut(5000);
    output.detach();
    await expect(fading).resolves.toBeUndefined();
    expect(output.active).toBe(false);
  });
});
