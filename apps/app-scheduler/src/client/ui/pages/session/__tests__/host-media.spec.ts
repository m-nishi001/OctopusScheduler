import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import type { Command } from "@octopus/session-hub";
import { registerMediaCommands } from "../../../../control/media/host-media-commands";
import type { MediaControls } from "../../../../control/media/host-media-commands";
import { AudioControl } from "../../../../control/media/audio";
import { ScreenControl } from "../../../../control/media/screen";
import { makeDevice, registerHostAgent, setupSessionEnv, settle } from "./session-test-kit";
import type { SessionEnv } from "./session-test-kit";

let env: SessionEnv;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
  env = setupSessionEnv();
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function fakeControls() {
  const audio = { play: vi.fn(async (_id: string) => undefined), stop: vi.fn(async (_id?: string, _fadeSec?: number) => undefined) };
  const screen = { show: vi.fn(async (_spec: unknown) => undefined), clear: vi.fn(async () => undefined) };
  return { audio, screen, controls: (): MediaControls => ({ audio, screen: screen as unknown as MediaControls["screen"] }) };
}

async function scene(controls: () => MediaControls) {
  const meta = await env.repo.create({ name: "会場" });
  const { agent } = registerHostAgent(env);
  registerMediaCommands(agent, controls);
  await agent.connection.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(env.hub, { memberId: "admin2" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  return { agent, admin };
}

const command = (over: Partial<Command>): Command => ({
  seq: 1,
  requestId: "r",
  game: "media",
  type: "play",
  payload: { assetId: "a1" },
  issuedBy: "someone",
  issuerRole: "admin",
  atMs: 0,
  ...over,
});

describe("registerMediaCommands(ホスト)", () => {
  it("管理端末の4種類の指示を、音楽・スクリーンの単体機能に渡す", async () => {
    const f = fakeControls();
    const { admin } = await scene(f.controls);
    await admin.conn.issue("media", "play", { assetId: "song1" });
    await admin.conn.issue("media", "stop", { assetId: "song1", fadeSec: 2 });
    await admin.conn.issue("media", "stop", {});
    await admin.conn.issue("media", "show", { spec: { kind: "image", id: "img1" } });
    await admin.conn.issue("media", "clear", {});
    await settle(5000);
    expect(f.audio.play).toHaveBeenCalledWith("song1");
    expect(f.audio.stop.mock.calls).toEqual([["song1", 2], [undefined, undefined]]);
    expect(f.screen.show).toHaveBeenCalledWith({ kind: "image", id: "img1" });
    expect(f.screen.clear).toHaveBeenCalledOnce();
  });

  it("不正なペイロードは、警告を出して捨てる", async () => {
    const f = fakeControls();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { admin } = await scene(f.controls);
    await admin.conn.issue("media", "play", { assetId: "../etc" });
    await admin.conn.issue("media", "show", { spec: { kind: "html", id: "x" } });
    await admin.conn.issue("media", "stop", { fadeSec: 99 });
    await admin.conn.issue("media", "reboot", {});
    await settle(5000);
    expect(f.audio.play).not.toHaveBeenCalled();
    expect(f.audio.stop).not.toHaveBeenCalled();
    expect(f.screen.show).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(4);
  });

  it("参加者(client)からの指示は、正しい形でも捨てる", async () => {
    const f = fakeControls();
    const { agent } = await scene(f.controls);
    await agent.router.dispatch(command({ issuerRole: "client", type: "play", payload: { assetId: "a1" } }));
    await agent.router.dispatch(command({ issuerRole: "client", type: "clear", payload: {} }));
    expect(f.audio.play).not.toHaveBeenCalled();
    expect(f.screen.clear).not.toHaveBeenCalled();
    await agent.router.dispatch(command({ issuerRole: "admin" }));
    expect(f.audio.play).toHaveBeenCalledWith("a1");
  });

  it("素材の取得を待たない。遅い表示の最中でも、あとの「消す」が処理される", async () => {
    let release!: (b: Blob) => void;
    const source = { ensure: vi.fn(() => new Promise<Blob>((resolve) => (release = resolve))) };
    const router = { push: vi.fn(async (_to: unknown) => undefined) };
    const screen = new ScreenControl(source, router, () => "/session/host/s1");
    const audio = new AudioControl(source, { loadFromBlob: vi.fn(), play: vi.fn(), stop: vi.fn(), disposeInstance: vi.fn() } as never);
    const { admin } = await scene(() => ({ audio, screen }));
    await admin.conn.issue("media", "show", { spec: { kind: "image", id: "big" } });
    await admin.conn.issue("media", "clear", {});
    await settle(5000);
    expect(source.ensure).toHaveBeenCalledWith("big");
    expect(router.push).toHaveBeenCalledWith("/session/host/s1");
    release(new Blob(["x"]));
    await settle(10);
    // 遅れて届いても、古い「表示」は捨てられ、画像の画面へは移らない
    expect(router.push).toHaveBeenCalledOnce();
  });

  it("指示で要る素材は ensure で取ってから鳴らす", async () => {
    const source = { ensure: vi.fn(async (_id: string) => new Blob(["a"])) };
    const fakeAudio = { loadFromBlob: vi.fn(async () => "i1"), play: vi.fn(async () => undefined), stop: vi.fn(), disposeInstance: vi.fn() };
    const audio = new AudioControl(source, fakeAudio as never);
    const screen = new ScreenControl(source, { push: vi.fn(async () => undefined) }, () => null);
    const { admin } = await scene(() => ({ audio, screen }));
    await admin.conn.issue("media", "play", { assetId: "song9" });
    await settle(5000);
    expect(source.ensure).toHaveBeenCalledWith("song9");
    expect(fakeAudio.play).toHaveBeenCalledWith("i1");
  });
});
