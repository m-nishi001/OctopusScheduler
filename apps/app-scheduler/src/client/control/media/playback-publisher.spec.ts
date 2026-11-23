import { describe, expect, it, vi } from "vitest";
import { registerPlaybackPublisher, type PlaybackSource } from "./playback-publisher";
import type { NowPlayingAudio } from "@model/media/now-playing";

type State = { phase: string; role: string };

function fakeAgent() {
  const listeners = new Set<(s: State) => void>();
  const published: unknown[] = [];
  const agent = {
    active: false,
    connection: { subscribe: (l: (s: State) => void) => (listeners.add(l), () => listeners.delete(l)) },
    publishSlice: vi.fn(async (ns: string, data: unknown) => {
      expect(ns).toBe("playback");
      published.push(data);
    }),
  };
  const emit = (state: State) => {
    agent.active = state.role === "host" && state.phase === "connected";
    listeners.forEach((l) => l(state));
  };
  return { agent: agent as never, published, join: () => emit({ phase: "connected", role: "host" }), leave: () => emit({ phase: "idle", role: "host" }), listeners };
}

function fakeSource(initial: NowPlayingAudio[] = []) {
  let playing = initial;
  const listeners = new Set<() => void>();
  const source: PlaybackSource = {
    snapshot: () => playing,
    subscribe: (l) => (listeners.add(l), () => listeners.delete(l)),
  };
  return { source, set: (next: NowPlayingAudio[]) => ((playing = next), listeners.forEach((l) => l())), listeners };
}

describe("registerPlaybackPublisher(ホスト)", () => {
  it("ホストとして入室したら、何も鳴っていなくても公開する(前のホストの分を上書きする)", () => {
    const { agent, published, join } = fakeAgent();
    const { source } = fakeSource();
    registerPlaybackPublisher(agent, () => source);
    join();
    expect(published).toEqual([{ audio: [] }]);
  });

  it("鳴っている曲が変わるたびに、そのときの一覧を公開する", () => {
    const { agent, published, join } = fakeAgent();
    const { source, set } = fakeSource();
    registerPlaybackPublisher(agent, () => source);
    join();
    set([{ assetId: "a", loop: true }]);
    set([]);
    expect(published).toEqual([{ audio: [] }, { audio: [{ assetId: "a", loop: true }] }, { audio: [] }]);
  });

  it("入室し直したら、鳴っている曲をまた公開する。重ねて購読しない", () => {
    const { agent, published, join, leave } = fakeAgent();
    const { source, set, listeners } = fakeSource([{ assetId: "a", loop: false }]);
    registerPlaybackPublisher(agent, () => source);
    join();
    leave();
    join();
    expect(listeners.size).toBe(1);
    expect(published).toEqual([{ audio: [{ assetId: "a", loop: false }] }, { audio: [{ assetId: "a", loop: false }] }]);
    set([]);
    expect(published).toHaveLength(3);
  });

  it("ホストでない間は公開しない。曲の窓口も、ホストになるまで取り出さない", () => {
    const { agent, published, leave } = fakeAgent();
    const getSource = vi.fn(() => fakeSource().source);
    registerPlaybackPublisher(agent, getSource);
    leave();
    expect(getSource).not.toHaveBeenCalled();
    expect(published).toEqual([]);
  });

  it("ホストでなくなったあとの曲の変化は公開しない", () => {
    const { agent, published, join, leave } = fakeAgent();
    const { source, set } = fakeSource();
    registerPlaybackPublisher(agent, () => source);
    join();
    leave();
    set([{ assetId: "a", loop: false }]);
    expect(published).toEqual([{ audio: [] }]);
  });

  it("解除すると、接続も曲も購読しない", () => {
    const { agent, join, listeners } = fakeAgent();
    const { source, listeners: audioListeners } = fakeSource();
    const dispose = registerPlaybackPublisher(agent, () => source);
    join();
    dispose();
    expect(listeners.size).toBe(0);
    expect(audioListeners.size).toBe(0);
  });
});
