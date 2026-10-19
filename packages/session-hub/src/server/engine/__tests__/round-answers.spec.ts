import { describe, it, expect } from "vitest";
import type { RoundAnswer } from "../../../shared/protocol";
import { isSameRespondent, upsertAnswer } from "../round-answers";

const answer = (deviceId: string, memberId: string | null, no: number, atMs: number, verified?: boolean): RoundAnswer => ({
  deviceId,
  memberId,
  label: memberId ?? "ゲスト",
  no,
  atMs,
  ...(verified ? { verified } : {}),
});

describe("isSameRespondent", () => {
  it("同じ端末は同じ参加者", () => {
    expect(isSameRespondent(answer("d1", null, 1, 10), answer("d1", null, 2, 20))).toBe(true);
  });

  it("ログインから確定した同じメンバーは、別の端末でも同じ参加者", () => {
    expect(isSameRespondent(answer("d1", "alice", 1, 10, true), answer("d2", "alice", 2, 20, true))).toBe(true);
  });

  it("匿名の申告は、同じ名前でも端末ごとに別の参加者(ログイン済みの本人と混ざらない)", () => {
    expect(isSameRespondent(answer("d1", "alice", 1, 10), answer("d2", "alice", 1, 20))).toBe(false);
    expect(isSameRespondent(answer("d1", "alice", 1, 10), answer("d2", "alice", 1, 20, true))).toBe(false);
    expect(isSameRespondent(answer("d1", "alice", 1, 10, true), answer("d2", "alice", 1, 20))).toBe(false);
  });
});

describe("upsertAnswer", () => {
  it("新しい参加者の回答は追加される", () => {
    const list: RoundAnswer[] = [];
    const result = upsertAnswer(list, answer("d1", "a", 1, 10, true), 5);
    expect(result.kind).toBe("inserted");
    expect(list).toHaveLength(1);
  });

  it("選び直すと置き換わり、回答時刻は最後に選んだ時刻になる", () => {
    const list = [answer("d1", "a", 1, 10, true)];
    const result = upsertAnswer(list, answer("d1", "a", 2, 50, true), 5);
    expect(result).toMatchObject({ kind: "replaced", answer: { no: 2, atMs: 50 } });
    expect(list).toEqual([answer("d1", "a", 2, 50, true)]);
  });

  it("別の端末から選び直しても、同じメンバーの1件が置き換わる", () => {
    const list = [answer("d1", "a", 1, 10, true)];
    const result = upsertAnswer(list, answer("d2", "a", 3, 60, true), 5);
    expect(result.kind).toBe("replaced");
    expect(list).toEqual([answer("d2", "a", 3, 60, true)]);
  });

  it("同じ選択の再送は何も変えない(回答時刻も動かさない)", () => {
    const list = [answer("d1", "a", 1, 10, true)];
    const result = upsertAnswer(list, answer("d1", "a", 1, 99, true), 5);
    expect(result).toMatchObject({ kind: "unchanged", answer: { atMs: 10 } });
    expect(list[0].atMs).toBe(10);
  });

  it("上限に達していると新しい参加者は受け付けないが、回答済みの人は選び直せる", () => {
    const list = [answer("d1", "a", 1, 10, true), answer("d2", "b", 1, 20, true)];
    expect(upsertAnswer(list, answer("d3", "c", 1, 30, true), 2).kind).toBe("full");
    expect(list).toHaveLength(2);
    expect(upsertAnswer(list, answer("d2", "b", 2, 40, true), 2).kind).toBe("replaced");
  });
});
