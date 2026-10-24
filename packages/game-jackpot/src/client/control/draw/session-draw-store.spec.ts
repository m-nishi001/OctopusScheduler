import "reflect-metadata";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { container } from "tsyringe";
import { HostAgent } from "@octopus/session-hub";
import { joinParticipant, makeDevice, makeHub } from "@octopus/session-hub/testing";
import { sessionService as svc } from "@octopus/session-hub/engine";
import { SessionDrawStore } from "./session-draw-store";
import { DrawConflictError } from "../../model/errors";
import type { DrawResultDto } from "./dto/draw-result-dto";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  container.clearInstances();
});
afterEach(() => vi.useRealTimers());

const members = [
  { id: "m1", name: "太郎", rank: 1 },
  { id: "m2", name: "花子", rank: 2 },
];
const prizes = [
  { id: "p1", name: "1等", order: 1 },
  { id: "p2", name: "2等", order: 2 },
];

async function scene() {
  const hub = makeHub();
  const meta = await svc.createSession(hub.deps, { name: "x" }, "a");
  const hostDevice = makeDevice(hub, { memberId: "a" });
  const agent = new HostAgent(hostDevice.conn);
  await hostDevice.conn.joinOperator({ sessionId: meta.id, role: "host", label: "PC" });
  const client = await joinParticipant(hub, meta.id, { memberId: "m1" });
  const directory = { getMembers: vi.fn(async () => members), getPrizes: vi.fn(async () => prizes) };
  const store = new SessionDrawStore(() => agent, directory);
  return { agent, client, store, directory, hostDevice };
}

const draw = (drawId: string, m: number, p: number, over: Partial<DrawResultDto> = {}): DrawResultDto => ({
  drawId,
  wonMember: members[m],
  wonPrize: prizes[p],
  isKakuhen: false,
  createdAt: 1000 + m,
  ...over,
});

describe("SessionDrawStore", () => {
  it("commit は参加者に見せず、reveal で初めて見える。DOには rev だけが載る", async () => {
    const { store, client } = await scene();
    await store.ensurePlan([], []);
    await store.commit(draw("d1", 0, 0));
    expect((await client.conn.getResults()).jackpot.draws).toHaveLength(0);
    expect((await store.pending())?.drawId).toBe("d1");
    await store.reveal("d1");
    await vi.advanceTimersByTimeAsync(3000);
    expect(client.conn.state.roomState?.data.results).toEqual({ rev: 1 });
    expect(JSON.stringify(client.conn.state.roomState?.data)).not.toContain("太郎");
    const view = await client.conn.getResults();
    expect(view.jackpot.draws[0]).toMatchObject({ memberName: "太郎", prizeName: "1等" });
    expect(await store.pending()).toBeNull();
  });

  it("読み出しは読み込み済みのメモリから返し、通信を増やさない", async () => {
    const { store, agent } = await scene();
    const get = vi.spyOn(agent, "getJackpotState");
    await store.load();
    await store.results();
    await store.plan();
    await store.pending();
    await store.results();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("新しい store(ホストの再読み込み)が、サーバーの結果を詳細つきで読み、未公開の行を pending で返す", async () => {
    const { store, agent, directory } = await scene();
    await store.ensurePlan([2], ["p2"]);
    await store.commit(draw("d1", 0, 0));
    const reloaded = new SessionDrawStore(() => agent, directory);
    expect(await reloaded.plan()).toEqual({ kakuhenTimings: [2], reservedPrizeIds: ["p2"] });
    const pending = await reloaded.pending();
    expect(pending).toMatchObject({ drawId: "d1", wonMember: { id: "m1", name: "太郎", rank: 1 }, wonPrize: { id: "p1", name: "1等" } });
  });

  it("矛盾(当選済みのメンバー)は DrawConflictError にして、状態を読み直す", async () => {
    const { store, agent } = await scene();
    await store.commit(draw("d1", 0, 0));
    await store.reveal("d1");
    const get = vi.spyOn(agent, "getJackpotState");
    await expect(store.commit(draw("d2", 0, 1))).rejects.toBeInstanceOf(DrawConflictError);
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("同じ内容の再送は成功する。公開されていない別の抽選があれば矛盾", async () => {
    const { store } = await scene();
    await store.commit(draw("d1", 0, 0));
    await store.commit(draw("d1", 0, 0));
    await expect(store.commit(draw("d2", 1, 1))).rejects.toThrow(/公開されていない/);
  });

  it("別の端末で結果がリセットされたあとの reveal は、DrawConflictError", async () => {
    const { store, agent, directory } = await scene();
    await store.commit(draw("d1", 0, 0));
    await new SessionDrawStore(() => agent, directory).reset();
    await expect(store.reveal("d1")).rejects.toBeInstanceOf(DrawConflictError);
    expect(await store.results()).toEqual([]);
  });

  it("接続していないときは保存できないと明示して失敗する(黙って捨てない)", async () => {
    const { store, hostDevice } = await scene();
    await store.load();
    vi.spyOn(hostDevice.conn, "state", "get").mockReturnValue({ ...hostDevice.conn.state, role: null, phase: "idle" } as never);
    await expect(store.commit(draw("d1", 0, 0))).rejects.toThrow(/接続していない/);
  });

  it("reset で結果と確変の予定が消える", async () => {
    const { store } = await scene();
    await store.ensurePlan([1], ["p1"]);
    await store.commit(draw("d1", 0, 1));
    await store.reset();
    expect(await store.results()).toEqual([]);
    expect(await store.plan()).toBeNull();
  });

  it("同じ抽選の公開が通信中なら、重ねて送らず、その完了を待つ(公開の通信は1回)", async () => {
    const { store, agent } = await scene();
    await store.ensurePlan([], []);
    await store.commit(draw("d1", 0, 0));
    const spy = vi.spyOn(agent, "revealJackpotDraw");
    await Promise.all([store.reveal("d1"), store.reveal("d1")]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await store.pending()).toBeNull();
    // 完了後の呼び出しは、また普通に送れる(何度呼んでも同じ結果)
    await store.reveal("d1");
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("公開が失敗したら、次の公開はやり直せる(失敗を覚えて塞がない)", async () => {
    const { store, agent } = await scene();
    await store.ensurePlan([], []);
    await store.commit(draw("d1", 0, 0));
    vi.spyOn(agent, "revealJackpotDraw").mockRejectedValueOnce(new Error("network"));
    await expect(store.reveal("d1")).rejects.toThrow("network");
    await store.reveal("d1");
    expect(await store.pending()).toBeNull();
  });

  describe("通信の間に読み直し(load)が入っても、書いたことがメモリから消えない", () => {
    it("commit の通信中に load が入れ替わっても、確定した抽選が pending に残る", async () => {
      const { store, agent } = await scene();
      await store.ensurePlan([], []);
      const real = agent.commitJackpotDraw.bind(agent);
      vi.spyOn(agent, "commitJackpotDraw").mockImplementation(async (input) => {
        await store.load(); // 書く前に、別の読み直しが、サーバーの(まだ d1 が無い)内容でメモリを入れ替える
        return real(input);
      });
      await store.commit(draw("d1", 0, 0));
      expect((await store.pending())?.drawId).toBe("d1");
      expect((await store.results()).filter((r) => r.drawId === "d1")).toHaveLength(1); // 二重に積まない
    });

    it("ensurePlan の通信中に load が入れ替わっても、予定がメモリに残る", async () => {
      const { store, agent } = await scene();
      await store.load();
      const real = agent.ensureJackpotPlan.bind(agent);
      vi.spyOn(agent, "ensureJackpotPlan").mockImplementation(async (input) => {
        await store.load();
        return real(input);
      });
      await store.ensurePlan([2], ["p2"]);
      expect(await store.plan()).toEqual({ kakuhenTimings: [2], reservedPrizeIds: ["p2"] });
    });

    it("reveal の通信中に load が入れ替わっても、公開済みとしてメモリに残る(次の確定を止める未公開に見えない)", async () => {
      const { store, agent } = await scene();
      await store.ensurePlan([], []);
      await store.commit(draw("d1", 0, 0));
      const real = agent.revealJackpotDraw.bind(agent);
      vi.spyOn(agent, "revealJackpotDraw").mockImplementation(async (id) => {
        await store.load(); // 書く前の(d1 がまだ未公開の)内容で入れ替わる
        return real(id);
      });
      await store.reveal("d1");
      expect(await store.pending()).toBeNull();
    });
  });
});
