import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioService } from "./audio-service";

/** 自動再生の制限(suspended)と、解除(resume)だけを真似た AudioContext。 */
class FakeAudioContext extends EventTarget {
  state: AudioContextState;
  resume = vi.fn(async () => {
    if (this.refuse) throw new Error("NotAllowedError");
    this.state = "running";
    this.dispatchEvent(new Event("statechange"));
  });
  constructor(public refuse = false) {
    super();
    this.state = "suspended";
  }
}

let created: FakeAudioContext;
let refuseNext = false;

beforeEach(() => {
  refuseNext = false;
  vi.stubGlobal("window", {
    AudioContext: class {
      constructor() {
        created = new FakeAudioContext(refuseNext);
        return created;
      }
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("AudioService.unlock", () => {
  it("制限されている(suspended)ときは resume して、running になる", async () => {
    const service = new AudioService();
    expect(service.state).toBe("suspended");
    await service.unlock();
    expect(created.resume).toHaveBeenCalledOnce();
    expect(service.state).toBe("running");
  });

  it("すでに running なら何もしない", async () => {
    const service = new AudioService();
    await service.unlock();
    await service.unlock();
    expect(created.resume).toHaveBeenCalledOnce();
  });

  it("解除できなくても例外にせず、suspended のままにする", async () => {
    refuseNext = true;
    const service = new AudioService();
    await expect(service.unlock()).resolves.toBeUndefined();
    expect(service.state).toBe("suspended");
  });
});

describe("AudioService.onStateChange", () => {
  it("状態が変わったら知らせ、解除関数のあとは知らせない", async () => {
    const service = new AudioService();
    const listener = vi.fn();
    const off = service.onStateChange(listener);
    await service.unlock();
    expect(listener).toHaveBeenCalledOnce();
    off();
    created.dispatchEvent(new Event("statechange"));
    expect(listener).toHaveBeenCalledOnce();
  });
});
