import "reflect-metadata";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { effectScope } from "vue";
import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import type { JackpotPublished } from "@octopus/session-hub";
import { joinParticipant, makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { useJackpotHost } from "./use-jackpot-host";
import type { JackpotHostHandlers } from "./use-jackpot-host";
import { buildJackpotDescriptionState } from "@model/jackpot-host-state";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => vi.advanceTimersByTimeAsync(ms);

const state = (over: Partial<JackpotPublished> = {}): JackpotPublished => ({
  page: "main-draw",
  stage: "member",
  canStop: false,
  member: null,
  memberId: null,
  prize: null,
  ...over,
});

/** 景品抽選で止められる場面。当選者は "winner"。 */
const prizeStop = (over: Partial<JackpotPublished> = {}) =>
  state({ stage: "prize", canStop: true, member: "太郎", memberId: "winner", ...over });
const STOP_FOR_WINNER = [{ key: "jackpot.stopRoulette", memberIds: ["winner"] }];

async function scene() {
  const hub = makeHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const hostDevice = makeDevice(hub, { memberId: "a" });
  const agent = new HostAgent(hostDevice.conn);
  container.register(HostAgent, { useValue: agent });
  await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const admin = makeDevice(hub, { memberId: "b" });
  await admin.conn.joinOperator({ sessionId: meta.id, role: "admin", label: "A" });
  const client = await joinParticipant(hub, meta.id, { memberId: "winner" });
  const other = await joinParticipant(hub, meta.id, { memberId: "other" });
  return { hub, meta, agent, admin, client, other, hostDevice };
}

function mountHost(handlers: JackpotHostHandlers) {
  const scope = effectScope();
  const host = scope.run(() => useJackpotHost(handlers))!;
  return { host, stop: () => scope.stop() };
}

describe("useJackpotHost", () => {
  it("ホストとして接続していない端末(HostAgent 未登録)では何もしない", () => {
    container.clearInstances();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    expect(() => host.publish(state())).not.toThrow();
  });

  it("管理端末の advance でハンドラが呼ばれる", async () => {
    const { admin } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    mountHost(handlers);
    await admin.conn.issue("jackpot", "advance");
    await tick(4000);
    expect(handlers.advance).toHaveBeenCalledTimes(1);
    expect(handlers.stopRoulette).not.toHaveBeenCalled();
  });

  it("管理端末の back でハンドラが呼ばれる。ハンドラが無い画面では何も起きない", async () => {
    const { admin } = await scene();
    const back = vi.fn();
    const mounted = mountHost({ advance: vi.fn(), back, stopRoulette: vi.fn() });
    await admin.conn.issue("jackpot", "back");
    await tick(4000);
    expect(back).toHaveBeenCalledTimes(1);
    mounted.stop();

    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    mountHost(handlers);
    await admin.conn.issue("jackpot", "back");
    await tick(4000);
    expect(handlers.advance).not.toHaveBeenCalled();
    expect(handlers.stopRoulette).not.toHaveBeenCalled();
  });

  it("説明画面の状態(スライド位置)を公開し、参加者に停止ボタンは出さない。stopRoulette も受け付けない", async () => {
    const { admin, client } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    host.publish(prizeStop()); // 直前の抽選画面の状態が残っていても
    host.publish(buildJackpotDescriptionState(1, 3));
    await tick(4000);
    expect(admin.conn.state.roomState?.data?.jackpot).toEqual(buildJackpotDescriptionState(1, 3));
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).not.toHaveBeenCalled();
  });

  it("stopRoulette は止められる場面(canStop)でだけ実行される。管理端末からでも同じ", async () => {
    const { admin } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).not.toHaveBeenCalled(); // まだ止められる場面ではない

    host.publish(state({ canStop: true }));
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);

    host.publish(state({ canStop: false }));
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);
  });

  it("メンバー抽選では canStop でも参加者に停止ボタンを出さず、参加者の停止は受け付けない(管理端末だけが止める)", async () => {
    const { admin, client } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);

    host.publish(state({ stage: "member", canStop: true }));
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);

    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);
  });

  it("景品抽選で canStop の間だけ参加者に停止ボタン(clientInput)が公開され、参加者の押下がホストに届く", async () => {
    const { hub, meta, client } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);

    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);

    host.publish(prizeStop());
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual(STOP_FOR_WINNER);
    await client.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);

    host.publish(prizeStop({ canStop: false }));
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    void hub;
    void meta;
  });

  it("景品抽選の停止は当選者本人だけが送れる。当選者以外には宛先が違うので受け付けず、ホストも止まらない(今回の不具合)", async () => {
    const { admin, client, other } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    host.publish(prizeStop());
    await tick(4000);

    await expect(other.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    await tick(4000);
    expect(handlers.stopRoulette).not.toHaveBeenCalled();

    await client.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);

    host.publish(prizeStop()); // 管理端末は宛先に関わらず止められる
    await admin.conn.issue("jackpot", "stopRoulette");
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(2);
  });

  it("当選者が分からない(memberId が無い)景品抽選では、参加者に停止を出さない(管理端末だけが止める)", async () => {
    const { client } = await scene();
    const { host } = mountHost({ advance: vi.fn(), stopRoulette: vi.fn() });
    host.publish(prizeStop({ memberId: null }));
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
  });

  it("複数の参加者が同時に止めても、ホストの進行は1回分(ハンドラ側の二重実行ガードに任せず、canStop 解除で後続を無視)", async () => {
    const { hub, meta } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host } = mountHost(handlers);
    host.publish(prizeStop());
    // ハンドラ内で止めた瞬間に次の場面へ進む想定: 最初の呼び出しで canStop を false にする
    handlers.stopRoulette.mockImplementation(() => host.publish(prizeStop({ canStop: false })));
    // 当選者が複数の端末(同じメンバー)から連打しても
    const clients = [0, 1, 2].map(() => joinParticipant(hub, meta.id, { memberId: "winner" }));
    await Promise.all(clients);
    await tick(4000);
    await Promise.all((await Promise.all(clients)).map((c) => c.conn.issue("jackpot", "stopRoulette").catch(() => undefined)));
    await tick(4000);
    expect(handlers.stopRoulette).toHaveBeenCalledTimes(1);
  });

  it("公開した状態が参加者・管理端末の画面に届く(名前空間 jackpot)", async () => {
    const { admin, client } = await scene();
    const { host } = mountHost({ advance: vi.fn(), stopRoulette: vi.fn() });
    host.publish(state({ member: "太郎", prize: "特賞" }));
    await tick(4000);
    expect((client.conn.state.roomState?.data as { jackpot?: JackpotPublished }).jackpot).toMatchObject({ member: "太郎", prize: "特賞" });
    expect((admin.conn.state.roomState?.data as { jackpot?: JackpotPublished }).jackpot?.stage).toBe("member");
  });

  it("画面を離れると、コマンドの受付を止め、公開していた状態と停止ボタンを取り下げる", async () => {
    const { admin, client } = await scene();
    const handlers = { advance: vi.fn(), stopRoulette: vi.fn() };
    const { host, stop } = mountHost(handlers);
    host.publish(prizeStop());
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual(STOP_FOR_WINNER);

    stop(); // 画面を離れた
    await tick(4000);
    expect(client.conn.state.roomState?.clientInput).toEqual([]);
    expect((client.conn.state.roomState?.data as { jackpot?: unknown }).jackpot).toBeUndefined();
    await expect(client.conn.issue("jackpot", "stopRoulette")).rejects.toThrow(/FORBIDDEN/);
    await admin.conn.issue("jackpot", "advance");
    await tick(4000);
    expect(handlers.advance).not.toHaveBeenCalled();
  });
});
