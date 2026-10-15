import { describe, expect, it } from "vitest";
import { RevealTracker, buildJackpotDraw, buildJackpotHostState, canStopAt } from "./jackpot-host-state";

describe("canStopAt", () => {
  it.each(["stopMemberDraw", "stopPrizeDraw", "stopKakuhenDummyDraw", "stopKakuhenFinalDraw"])("%s は止められる", (l) => {
    expect(canStopAt(l)).toBe(true);
  });
  it.each([undefined, "", "startMemberDraw", "showMemberWinnerDialog", "stop"])("%j は止められない", (l) => {
    expect(canStopAt(l as string | undefined)).toBe(false);
  });
});

describe("RevealTracker", () => {
  it("当選者はメンバー停止で、賞品は賞品停止で公開される。ダミー停止では賞品は公開されない", () => {
    const t = new RevealTracker();
    expect([t.memberRevealed, t.prizeRevealed]).toEqual([false, false]);
    t.onAction("stopMemberDraw");
    expect([t.memberRevealed, t.prizeRevealed]).toEqual([true, false]);
    t.onAction("stopKakuhenDummyDraw");
    expect(t.prizeRevealed).toBe(false);
    t.onAction("stopKakuhenFinalDraw");
    expect(t.prizeRevealed).toBe(true);
  });

  it("通常の賞品停止でも公開され、ラベル無し・無関係なステップでは変わらない。reset で隠れる", () => {
    const t = new RevealTracker();
    t.onAction(undefined);
    t.onAction("showMemberWinnerDialog");
    expect([t.memberRevealed, t.prizeRevealed]).toEqual([false, false]);
    t.onAction("stopPrizeDraw");
    expect(t.prizeRevealed).toBe(true);
    t.reset();
    expect([t.memberRevealed, t.prizeRevealed]).toEqual([false, false]);
  });
});

describe("buildJackpotHostState", () => {
  const base = { phase: "member", nextLabel: undefined as string | undefined, memberName: "太郎", memberId: "taro", prizeName: "特賞" };

  it("停止演出が終わるまで当選者・賞品を含めない(ネタバレ防止)", () => {
    const t = new RevealTracker();
    expect(buildJackpotHostState({ ...base, tracker: t })).toEqual({ page: "main-draw", phase: "member", canStop: false, member: null, memberId: null, prize: null });
  });

  it("メンバー停止後は当選者だけ、賞品停止後は賞品も含める", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    expect(buildJackpotHostState({ ...base, tracker: t })).toMatchObject({ member: "太郎", memberId: "taro", prize: null });
    t.onAction("stopPrizeDraw");
    expect(buildJackpotHostState({ ...base, tracker: t })).toMatchObject({ member: "太郎", prize: "特賞" });
  });

  it("次が停止ステップのときだけ canStop", () => {
    const t = new RevealTracker();
    expect(buildJackpotHostState({ ...base, nextLabel: "stopPrizeDraw", tracker: t }).canStop).toBe(true);
    expect(buildJackpotHostState({ ...base, nextLabel: undefined, tracker: t }).canStop).toBe(false);
  });

  it("名前が未定(null/undefined)でも壊れず null になる", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    t.onAction("stopPrizeDraw");
    expect(buildJackpotHostState({ ...base, memberName: undefined, memberId: undefined, prizeName: null, tracker: t })).toMatchObject({ member: null, memberId: null, prize: null });
  });

  it("公開サイズは小さい(RoomStateの上限6KBに十分収まる)", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    t.onAction("stopPrizeDraw");
    const json = JSON.stringify(buildJackpotHostState({ ...base, memberName: "あ".repeat(30), prizeName: "い".repeat(30), tracker: t }));
    expect(json.length).toBeLessThan(500);
  });
});

describe("buildJackpotDraw", () => {
  const result = {
    drawId: "d1",
    wonMember: { id: "m1", name: "太郎" },
    wonPrize: { id: "p1", name: "1等" },
    isKakuhen: true,
    createdAt: 123,
  };

  it("当選者と賞品の両方が画面に見えるまでは保存しない(ネタバレ防止)", () => {
    const t = new RevealTracker();
    expect(buildJackpotDraw(result, t)).toBeNull();
    t.onAction("stopMemberDraw");
    expect(buildJackpotDraw(result, t)).toBeNull();
    t.onAction("stopPrizeDraw");
    expect(buildJackpotDraw(result, t)).toEqual({
      drawId: "d1",
      memberId: "m1",
      memberName: "太郎",
      prizeId: "p1",
      prizeName: "1等",
      isKakuhen: true,
      atMs: 123,
    });
  });

  it("確変の最終抽選でも公開済みになり、次の抽選に進む(reset)と保存しない", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    t.onAction("stopKakuhenDummyDraw");
    expect(buildJackpotDraw(result, t)).toBeNull();
    t.onAction("stopKakuhenFinalDraw");
    expect(buildJackpotDraw(result, t)).not.toBeNull();
    t.reset();
    expect(buildJackpotDraw(result, t)).toBeNull();
  });

  it("結果が無い・当選者や賞品が無いときは null", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    t.onAction("stopPrizeDraw");
    expect(buildJackpotDraw(null, t)).toBeNull();
    expect(buildJackpotDraw({ ...result, wonMember: null }, t)).toBeNull();
    expect(buildJackpotDraw({ ...result, wonPrize: null }, t)).toBeNull();
  });
});
