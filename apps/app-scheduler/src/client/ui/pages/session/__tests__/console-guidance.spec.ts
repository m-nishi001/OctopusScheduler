import { describe, expect, it } from "vitest";
import { describeProgress } from "../console-guidance";
import type { GuidanceInput } from "../console-guidance";

const base: GuidanceInput = { hostPath: "/session/host/s1", jackpot: null, quiz: null, answerCount: null, hostOnline: true, demo: false };
const at = (over: Partial<GuidanceInput>) => describeProgress({ ...base, ...over });

describe("describeProgress: 全ての状態で「いま」と「押すと起きること」が言える", () => {
  it("ホスト不在なら主ボタンは出さない", () => {
    const g = at({ hostOnline: false });
    expect(g.now).toContain("ホストの画面が開かれていません");
    expect(g.main).toBeNull();
  });

  it("ロビー/エントリー画面は待機中で、主ボタンは無い(始めるのは「始める」カード)", () => {
    expect(at({}).main).toBeNull();
    expect(at({}).game).toBeNull();
    expect(at({ hostPath: "/event-entry" }).now).toContain("エントリー");
  });

  describe("クイズ", () => {
    const quiz = (page: string, phase = "idle") => at({ hostPath: `/execute/quiz/q1/${page}`, quiz: { page, phase, title: "果物" } });

    it.each([
      ["intro", "イントロ", "QR"],
      ["qr", "QRコード", "回答受付"],
      ["answer", "正解発表", "結果"],
      ["result", "結果発表", "景品"],
    ])("%s: 主ボタンは「次へ」で、予告が出る", (page, now, hint) => {
      const g = quiz(page);
      expect(g.game).toBe("quiz");
      expect(g.now).toContain(now);
      expect(g.main).toMatchObject({ label: "次へ", action: { kind: "advance" } });
      expect(g.main!.hint).toContain(hint);
    });

    it("出題: 回答受付中は主ボタンが「受付を締め切る」になり、回答数が出る", () => {
      const g = at({ hostPath: "/execute/quiz/q1/play", quiz: { page: "play", phase: "answering", title: "果物" }, answerCount: 3 });
      expect(g.now).toContain("回答受付中");
      expect(g.now).toContain("回答 3 人");
      expect(g.main).toMatchObject({ label: "受付を締め切る", action: { kind: "closeAnswers" } });
    });

    it("出題: 受付終了後は「次へ」で正解を発表する", () => {
      const g = quiz("play", "closed");
      expect(g.now).toContain("受付終了");
      expect(g.main).toMatchObject({ label: "次へ", action: { kind: "advance" } });
      expect(g.main!.hint).toContain("正解");
    });

    it("出題の準備中(まだ受付が始まっていない)は押せる操作を出さない", () => {
      expect(quiz("play", "idle").main).toBeNull();
    });

    it("デモの ?demo=1 付きパスでも同じに判定する", () => {
      expect(at({ hostPath: "/execute/quiz/q1/qr?demo=1", quiz: { page: "qr", phase: "idle" } }).now).toContain("QRコード");
    });
  });

  describe("ジャックポット", () => {
    it("オープニング → 説明 → 抽選 の順に、主ボタンで画面を切り替える", () => {
      expect(at({ hostPath: "/jackpot-opening" }).main).toMatchObject({ label: "説明へ", action: { kind: "navigate", path: "/jackpot-description" } });
      expect(at({ hostPath: "/execute/jackpot-description" }).main).toMatchObject({ label: "抽選を始める", action: { kind: "navigate", path: "/jackpot-draw" } });
      expect(at({ hostPath: "/jackpot-result" }).main).toMatchObject({ label: "エンディングへ", action: { kind: "navigate", path: "/jackpot-ending" } });
    });

    it("デモのセッションでは遷移先に ?demo=1 が付く", () => {
      expect(at({ hostPath: "/jackpot-opening", demo: true }).main).toMatchObject({ action: { kind: "navigate", path: "/jackpot-description?demo=1" } });
    });

    it("エンディングは押せる操作が無い", () => {
      expect(at({ hostPath: "/jackpot-ending" }).main).toBeNull();
    });

    const draw = (jackpot: Parameters<typeof at>[0]["jackpot"]) => at({ hostPath: "/execute/jackpot-draw", jackpot });

    it("抽選画面を開いた直後(状態が届く前)は準備中", () => {
      expect(draw(null).main).toBeNull();
    });

    it("止められる場面では主ボタンが「止める」になる(メンバー/景品で予告が変わる)", () => {
      const member = draw({ phase: "member", canStop: true, member: null, prize: null });
      expect(member.main).toMatchObject({ label: "止める", action: { kind: "advance" } });
      expect(member.main!.hint).toContain("メンバー");
      const prize = draw({ phase: "prize", canStop: true, member: "太郎", prize: null });
      expect(prize.main!.hint).toContain("景品");
    });

    it("止められない場面では「次へ」。当選者・景品が決まっていれば「いま」に出る", () => {
      const g = draw({ phase: "prize", canStop: false, member: "太郎", prize: "特賞" });
      expect(g.main).toMatchObject({ label: "次へ", action: { kind: "advance" } });
      expect(g.now).toContain("景品抽選");
      expect(g.now).toContain("当選者: 太郎");
      expect(g.now).toContain("景品: 特賞");
    });
  });
});
