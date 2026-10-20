import { describe, expect, it } from "vitest";
import { GAS_LIKE_LIMITS, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createTestHub } from "../../../testing";
import * as svc from "../session-service";
import { MAX_ROUND_ANSWERS_KV } from "../../../shared/session-types";
import type { JoinResult } from "../../../shared/protocol";

/**
 * GAS の ScriptProperty は「1値 約9KB・全体 約500KB」。本番の GAS で初めて分かる不具合にならないよう、
 * 同じ上限をかけた保存先でセッションの一連の処理を流す。
 */

const OPTIONS = [
  { no: 1, text: "りんご" },
  { no: 2, text: "みかん" },
];

/** 日本語の長めの名前(1文字3バイト)。回答1件が大きくなる最悪に近いケース。 */
const longName = (i: number): string => `${"あ".repeat(20)}${i}`;

async function startSession(hub: ReturnType<typeof createTestHub>, clients: number) {
  const meta = await svc.createSession(hub.deps, { name: "会場" }, "a");
  const host = await svc.joinOperator(hub.deps, { sessionId: meta.id, role: "host", label: "PC" }, "a");
  await svc.setPortalSession(hub.deps, { sessionId: meta.id, published: true });
  const players: JoinResult[] = [];
  for (let i = 0; i < clients; i++) {
    players.push(await svc.joinPortal(hub.deps, {}, { id: `m${i}`, name: longName(i) }));
  }
  const creds = (j: JoinResult) => ({ sessionId: meta.id, deviceId: j.deviceId, token: j.token });
  return { meta, host, players, creds };
}

const usedBytes = (hub: ReturnType<typeof createTestHub>): number => (hub.storage as InMemoryKeyValueStorage).scalarBytesUsed();

describe("GAS の容量の上限(1値9KB・全体500KB)での回答ラウンド", () => {
  it(`回答の上限(${MAX_ROUND_ANSWERS_KV}件)まで、長い名前でも受け付けられ、全件を取り出せる`, async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    const { meta, host, players, creds } = await startSession(hub, MAX_ROUND_ANSWERS_KV);
    await svc.openRound(hub.deps, { ...creds(host), key: "q1", options: OPTIONS, durationMs: 60_000 });

    for (const p of players) await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: 1 });

    const { answers, round } = await svc.getAnswers(hub.deps, { ...creds(host), key: "q1" });
    expect(answers).toHaveLength(MAX_ROUND_ANSWERS_KV);
    expect(round.answerCount).toBe(MAX_ROUND_ANSWERS_KV);
    expect(meta.id).toBeTruthy();
  });

  it("かたまりをまたいで選び直しても、件数は増えず、最後の選択が残る", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    const { host, players, creds } = await startSession(hub, 60);
    await svc.openRound(hub.deps, { ...creds(host), key: "q1", options: OPTIONS, durationMs: 60_000 });
    for (const p of players) await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: 1 });

    // 先頭・中ほど・末尾の人が選び直す(それぞれ別のかたまりに入っている)
    for (const i of [0, 30, 59]) await svc.submitAnswer(hub.deps, { ...creds(players[i]), key: "q1", no: 2 });

    const { answers } = await svc.getAnswers(hub.deps, { ...creds(host), key: "q1" });
    expect(answers).toHaveLength(60);
    expect(answers.filter((a) => a.no === 2).map((a) => a.label).sort()).toEqual([0, 30, 59].map((i) => longName(i)).sort());
  });

  it("上限を超える回答は、容量エラーではなく、上限に達した旨のエラーで断る(受け付けた分は壊れない)", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    const { host, players, creds } = await startSession(hub, MAX_ROUND_ANSWERS_KV + 1);
    await svc.openRound(hub.deps, { ...creds(host), key: "q1", options: OPTIONS, durationMs: 60_000 });
    for (const p of players.slice(0, MAX_ROUND_ANSWERS_KV)) await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: 1 });

    await expect(svc.submitAnswer(hub.deps, { ...creds(players[MAX_ROUND_ANSWERS_KV]), key: "q1", no: 1 })).rejects.toThrow(/上限/);
    expect((await svc.getAnswers(hub.deps, { ...creds(host), key: "q1" })).answers).toHaveLength(MAX_ROUND_ANSWERS_KV);
  });

  it("次のラウンドを始めると、前のラウンドの回答は見えない(かたまりが残っていても)", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    const { host, players, creds } = await startSession(hub, 60);
    await svc.openRound(hub.deps, { ...creds(host), key: "q1", options: OPTIONS, durationMs: 60_000 });
    for (const p of players) await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: 1 });

    await svc.openRound(hub.deps, { ...creds(host), key: "q2", options: OPTIONS, durationMs: 60_000 });
    expect((await svc.getAnswers(hub.deps, { ...creds(host), key: "q2" })).answers).toHaveLength(0);
    await svc.submitAnswer(hub.deps, { ...creds(players[40]), key: "q2", no: 2 });
    expect((await svc.getAnswers(hub.deps, { ...creds(host), key: "q2" })).answers).toHaveLength(1);
  });
});

describe("GAS の容量の上限での、セッションの蓄積と掃除", () => {
  it("参加者300人でも、1セッションが全体の容量(500KB)に収まる", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    await startSession(hub, 300);
    expect(usedBytes(hub)).toBeLessThan(GAS_LIKE_LIMITS.maxTotalScalarBytes);
  });

  it("終わって一覧から外れたセッションの保存データは、次のセッション作成時に消える", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    const first = await startSession(hub, 20);
    await svc.closeSession(hub.deps, { sessionId: first.meta.id });
    const withFirst = usedBytes(hub);

    hub.clock.advance(2 * 60 * 60 * 1000); // 終了から1時間以上
    await svc.createSession(hub.deps, { name: "次" }, "a");

    expect(await hub.storage.get(`session-hub/s/${first.meta.id}/head`)).toBeNull();
    expect(await hub.storage.get(`session-hub/s/${first.meta.id}/dev/${first.players[0].deviceId}`)).toBeNull();
    expect(usedBytes(hub)).toBeLessThan(withFirst);
  });

  it("イベントを何回繰り返しても、使用量が積み上がらず、容量エラーにならない", async () => {
    const hub = createTestHub({ storageLimits: GAS_LIKE_LIMITS });
    let steady = 0;
    for (let event = 0; event < 40; event++) {
      const { meta, host, players, creds } = await startSession(hub, 50);
      await svc.openRound(hub.deps, { ...creds(host), key: "q1", options: OPTIONS, durationMs: 60_000 });
      for (const p of players) await svc.submitAnswer(hub.deps, { ...creds(p), key: "q1", no: 1 });
      await svc.closeSession(hub.deps, { sessionId: meta.id });
      hub.clock.advance(2 * 60 * 60 * 1000);
      if (event === 10) steady = usedBytes(hub);
    }
    // 10回目以降は、1イベントぶん程度のゆらぎしか増えない(掃除されている)
    expect(usedBytes(hub)).toBeLessThan(steady * 1.3);
    expect(usedBytes(hub)).toBeLessThan(GAS_LIKE_LIMITS.maxTotalScalarBytes);
  });
});
