import { describe, expect, it } from "vitest";
import { describeProgress } from "../console-guidance";
import { JACKPOT_STAGES } from "@octopus/session-hub";
import type { JackpotPublished } from "@octopus/session-hub";
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
      ["intro", "イントロ", "エントリー"],
      ["entry", "エントリー受付中", "回答受付"],
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
      expect(at({ hostPath: "/execute/quiz/q1/entry?demo=1", quiz: { page: "entry", phase: "idle" } }).now).toContain("エントリー受付中");
    });
  });

  describe("ジャックポット", () => {
    it("オープニング → 説明 → 抽選 の順に、主ボタンで画面を切り替える", () => {
      expect(at({ hostPath: "/jackpot-opening" }).main).toMatchObject({ label: "説明へ", action: { kind: "navigate", path: "/jackpot-description" } });
      expect(at({ hostPath: "/execute/jackpot-description" }).main).toMatchObject({ label: "抽選を始める", action: { kind: "navigate", path: "/jackpot-draw" } });
      expect(at({ hostPath: "/jackpot-result" }).main).toMatchObject({ label: "エンディングへ", action: { kind: "navigate", path: "/jackpot-ending" } });
    });

    describe("説明のスライド", () => {
      const desc = (index: number, total: number, over: Partial<GuidanceInput> = {}) =>
        at({ hostPath: "/execute/jackpot-description", jackpot: { page: "description", index, total, stage: "waiting", canStop: false, member: null, memberId: null, prize: null }, ...over });

      it("導入画面: 主ボタンは最初のスライドへ(advance)。前へは無い", () => {
        const g = desc(-1, 3);
        expect(g.now).toContain("導入");
        expect(g.main).toMatchObject({ label: "次のスライドへ (1/3)", action: { kind: "advance" } });
        expect(g.back).toBeNull();
      });

      it("途中のスライド: 次のスライド位置が出て、前へが使える", () => {
        const first = desc(0, 3);
        expect(first.now).toContain("(1/3)");
        expect(first.main).toMatchObject({ label: "次のスライドへ (2/3)", action: { kind: "advance" } });
        expect(first.back).toMatchObject({ label: "前へ" });
        expect(first.back!.hint).toContain("導入");
        expect(desc(1, 3).main).toMatchObject({ label: "次のスライドへ (3/3)", action: { kind: "advance" } });
        expect(desc(1, 3).back!.hint).toContain("ひとつ前");
      });

      it("最後のスライド: 主ボタンは「抽選を始める」(抽選画面へ切り替え)。前へは使える", () => {
        const g = desc(2, 3);
        expect(g.main).toMatchObject({ label: "抽選を始める", action: { kind: "navigate", path: "/jackpot-draw" } });
        expect(g.back).not.toBeNull();
        expect(desc(2, 3, { demo: true }).main).toMatchObject({ action: { kind: "navigate", path: "/jackpot-draw?demo=1" } });
      });

      it("スライドが0枚: 導入からそのまま「抽選を始める」。前へは無い", () => {
        const g = desc(-1, 0);
        expect(g.main).toMatchObject({ label: "抽選を始める", action: { kind: "navigate" } });
        expect(g.back).toBeNull();
      });

      it("1枚だけ: 導入では次へ、そのスライドで「抽選を始める」", () => {
        expect(desc(-1, 1).main).toMatchObject({ label: "次のスライドへ (1/1)", action: { kind: "advance" } });
        expect(desc(0, 1).main).toMatchObject({ label: "抽選を始める" });
        expect(desc(0, 1).back).not.toBeNull();
      });

      it("スライドの位置がまだ届いていない/別画面の状態が残っているときは、従来どおり「抽選を始める」で戻れない", () => {
        const stale: Array<JackpotPublished | null> = [null, { page: "main-draw", stage: "member", canStop: false, member: null, memberId: null, prize: null }, { page: "main-draw", stage: "prize", canStop: true, member: null, memberId: null, prize: null }];
        for (const jackpot of stale) {
          const g = at({ hostPath: "/execute/jackpot-description", jackpot });
          expect(g.main).toMatchObject({ label: "抽選を始める", action: { kind: "navigate", path: "/jackpot-draw" } });
          expect(g.back ?? null).toBeNull();
        }
      });

      it("ホスト不在なら何も出さない", () => {
        const g = desc(0, 3, { hostOnline: false });
        expect(g.main).toBeNull();
        expect(g.back ?? null).toBeNull();
      });
    });

    it("デモのセッションでは遷移先に ?demo=1 が付く", () => {
      expect(at({ hostPath: "/jackpot-opening", demo: true }).main).toMatchObject({ action: { kind: "navigate", path: "/jackpot-description?demo=1" } });
    });

    it("エンディングは押せる操作が無い", () => {
      expect(at({ hostPath: "/jackpot-ending" }).main).toBeNull();
    });

    const draw = (jackpot: Partial<NonNullable<Parameters<typeof at>[0]["jackpot"]>> | null) =>
      at({
        hostPath: "/execute/jackpot-draw",
        jackpot: jackpot && { page: "main-draw", stage: "waiting", canStop: false, member: null, memberId: null, prize: null, ...jackpot },
      });

    it("抽選画面を開いた直後(状態が届く前)は準備中", () => {
      expect(draw(null).main).toBeNull();
    });

    it("止められる場面では主ボタンが「止める」になる(メンバー/景品で予告が変わる)", () => {
      const member = draw({ stage: "member", canStop: true });
      expect(member.main).toMatchObject({ label: "止める", action: { kind: "advance" } });
      expect(member.main!.hint).toContain("メンバー");
      const prize = draw({ stage: "prize", canStop: true, member: "太郎" });
      expect(prize.main!.hint).toContain("景品");
    });

    it("止められない場面では「次へ」。当選者・景品が決まっていれば「いま」に出る", () => {
      const g = draw({ stage: "prize-revealed", canStop: false, member: "太郎", prize: "特賞" });
      expect(g.main).toMatchObject({ label: "次へ", action: { kind: "advance" } });
      expect(g.now).toContain("景品抽選");
      expect(g.now).toContain("当選者: 太郎");
      expect(g.now).toContain("景品: 特賞");
    });

    it("全ての場面で「いま」と主ボタンが言える。終了(ended)では、主ボタンが「結果へ」になる(今回の不具合: 進行不能)", () => {
      for (const stage of JACKPOT_STAGES) {
        const g = draw({ stage });
        expect(g.now, stage).toContain("ジャックポット");
        expect(g.main, stage).not.toBeNull();
      }
      const ended = draw({ stage: "ended", member: "太郎", prize: "特賞" });
      expect(ended.now).toContain("抽選は終了");
      expect(ended.main).toMatchObject({ label: "結果へ", action: { kind: "advance" } });
      expect(ended.main!.hint).toContain("結果");
    });

    it("当選者が見えている場面(member-revealed)は、メンバー抽選として「次へ」(景品抽選へ進める)", () => {
      const g = draw({ stage: "member-revealed", member: "太郎" });
      expect(g.now).toContain("メンバー抽選");
      expect(g.main).toMatchObject({ label: "次へ", action: { kind: "advance" } });
    });
  });
});
