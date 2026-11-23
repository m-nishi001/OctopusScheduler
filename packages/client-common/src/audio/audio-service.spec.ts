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

/** GainNode の予定の呼び出しを順に記録する AudioParam。 */
class FakeParam {
  calls: Array<[string, ...number[]]> = [];
  value = 1;
  cancelScheduledValues = vi.fn((t: number) => void this.calls.push(["cancel", t]));
  setValueAtTime = vi.fn((v: number, t: number) => void this.calls.push(["set", v, t]));
  linearRampToValueAtTime = vi.fn((v: number, t: number) => void this.calls.push(["ramp", v, t]));
}

class FakeSource {
  buffer: unknown = null;
  loop = false;
  onended: (() => void) | null = null;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
}

class PlayableContext extends EventTarget {
  state: AudioContextState = "running";
  currentTime = 10;
  destination = {};
  gains: FakeParam[] = [];
  sources: FakeSource[] = [];
  createGain() {
    const gain = new FakeParam();
    this.gains.push(gain);
    return { gain, connect: vi.fn(), disconnect: vi.fn() };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData = vi.fn(async () => ({ duration: 30 }));
}

describe("AudioService.stop", () => {
  let context: PlayableContext;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("window", {
      AudioContext: class {
        constructor() {
          context = new PlayableContext();
          return context;
        }
      },
    });
    vi.stubGlobal("crypto", { randomUUID: () => "id-1" });
  });
  afterEach(() => vi.useRealTimers());

  // FileReader は node に無いので、ArrayBuffer から直接読み込む入口を通す
  async function load(service: AudioService): Promise<string> {
    return (service as unknown as { decodeAudioData(b: ArrayBuffer): Promise<string> }).decodeAudioData(new ArrayBuffer(1));
  }

  it("フェードして止めるときは、いまの音量を起点に置いてから 0 まで下げる(起点なしだと一瞬で落ちる)", async () => {
    const service = new AudioService();
    const id = await load(service);
    await service.play(id);
    const gain = context.gains[0];
    gain.calls.length = 0;
    gain.value = 0.8; // 再生中のいまの音量
    context.currentTime = 100;
    const stopping = service.stop(id, 2000);
    expect(gain.calls).toEqual([
      ["cancel", 100],
      ["set", 0.8, 100],
      ["ramp", 0, 102],
    ]);
    await vi.advanceTimersByTimeAsync(2000);
    await stopping;
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
  });

  it("フェード中にもう一度フェード付きで止めても、下げ直さず壊れない(最初の停止の完了で、両方が終わる)", async () => {
    const service = new AudioService();
    const id = await load(service);
    await service.play(id);
    const gain = context.gains[0];
    const first = service.stop(id, 1000);
    const rampsBefore = gain.linearRampToValueAtTime.mock.calls.length;
    const second = service.stop(id, 1000);
    expect(gain.linearRampToValueAtTime.mock.calls.length).toBe(rampsBefore);
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([first, second]);
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
    await expect(service.stop(id, 1000)).resolves.toBeUndefined(); // 止まったあとの停止は何もしない
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
  });

  it("フェードの途中に、フェードなしで止めると、すぐ止まり、待っていた呼び出しも終わる", async () => {
    const service = new AudioService();
    const id = await load(service);
    await service.play(id);
    const fading = service.stop(id, 5000);
    await service.stop(id, 0);
    await fading;
    expect(context.sources[0].stop).toHaveBeenCalledOnce();
  });

  it("自然に終わったときだけ onEnded を呼ぶ。stop のあとの ended や、ループ再生では呼ばない", async () => {
    const service = new AudioService();
    const id = await load(service);
    const onEnded = vi.fn();
    await service.play(id, 0, false, onEnded);
    context.sources[0].onended?.();
    expect(onEnded).toHaveBeenCalledOnce();

    await service.play(id, 0, false, onEnded);
    await service.stop(id, 0);
    context.sources[1].onended?.();
    expect(onEnded).toHaveBeenCalledOnce();

    await service.play(id, 0, true, onEnded);
    context.sources[2].onended?.();
    expect(onEnded).toHaveBeenCalledOnce();
  });

});
