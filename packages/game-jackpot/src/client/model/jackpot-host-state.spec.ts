import { describe, expect, it } from "vitest";
import { RevealTracker, buildJackpotDescriptionState, buildJackpotHostState, canStopAt, deriveStage, revealableDrawId } from "./jackpot-host-state";
import { JACKPOT_STAGES, readJackpotState } from "@octopus/session-hub";

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

describe("deriveStage(場面を1か所で決める)", () => {
  const at = (phase: string, reveal: { member?: boolean; prize?: boolean } = {}, ended = false) => {
    const tracker = new RevealTracker();
    if (reveal.member) tracker.onAction("stopMemberDraw");
    if (reveal.prize) tracker.onAction("stopPrizeDraw");
    return deriveStage({ phase, tracker, ended });
  };

  it("1回の抽選の流れ: 準備 → メンバー抽選 → 当選者が見える → 景品抽選 → 景品が見える", () => {
    expect(at("idle")).toBe("waiting");
    expect(at("member")).toBe("member");
    expect(at("member", { member: true })).toBe("member-revealed"); // 当選者が見えているが、景品抽選にはまだ進んでいない
    expect(at("prize", { member: true })).toBe("prize"); // 景品抽選に進むと member-revealed は終わる(当選表示が閉じる)
    expect(at("prize", { member: true, prize: true })).toBe("prize-revealed");
  });

  it("抽選が終わっていれば、どの段階でも ended", () => {
    for (const phase of ["idle", "member", "prize"]) {
      expect(at(phase, { member: true, prize: true }, true)).toBe("ended");
      expect(at(phase, {}, true)).toBe("ended");
    }
  });

  it("次の抽選が始まる(reset)と、前回の当選者・景品は場面から外れる", () => {
    const tracker = new RevealTracker();
    tracker.onAction("stopMemberDraw");
    tracker.onAction("stopPrizeDraw");
    expect(deriveStage({ phase: "prize", tracker, ended: false })).toBe("prize-revealed");
    tracker.reset();
    expect(deriveStage({ phase: "member", tracker, ended: false })).toBe("member");
  });

  it("どの組み合わせでも、公開される場面は定義済みのものだけ", () => {
    for (const phase of ["idle", "member", "prize", "unknown"]) {
      for (const member of [false, true]) {
        for (const prize of [false, true]) {
          for (const ended of [false, true]) {
            expect(JACKPOT_STAGES).toContain(at(phase, { member, prize }, ended));
          }
        }
      }
    }
  });
});

describe("公開状態は、管理端末・ポータルが読む形と一致する(ホスト → 読み取り)", () => {
  it("抽選画面の状態を、そのまま読み取れる。場面は stage で伝わる", () => {
    const tracker = new RevealTracker();
    tracker.onAction("stopMemberDraw");
    const state = buildJackpotHostState({ phase: "member", nextLabel: undefined, tracker, memberName: "太郎", memberId: "taro", prizeName: "特賞" });
    expect(readJackpotState({ jackpot: JSON.parse(JSON.stringify(state)) })).toEqual(state);
    expect(state.stage).toBe("member-revealed");
  });

  it("説明画面の状態は、場面は waiting のまま、スライドの位置(index/total)を伝える", () => {
    const state = buildJackpotDescriptionState(1, 3);
    expect(state).toMatchObject({ page: "description", stage: "waiting", canStop: false, member: null, prize: null, index: 1, total: 3 });
    expect(readJackpotState({ jackpot: JSON.parse(JSON.stringify(state)) })).toEqual(state);
  });
});

describe("buildJackpotHostState", () => {
  const base = { phase: "member", nextLabel: undefined as string | undefined, memberName: "太郎", memberId: "taro", prizeName: "特賞" };

  it("停止演出が終わるまで当選者・賞品を含めない(ネタバレ防止)", () => {
    const t = new RevealTracker();
    expect(buildJackpotHostState({ ...base, tracker: t })).toEqual({ page: "main-draw", stage: "member", canStop: false, member: null, memberId: null, prize: null });
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

describe("revealableDrawId", () => {
  const result = {
    drawId: "d1",
    wonMember: { id: "m1", name: "太郎" },
    wonPrize: { id: "p1", name: "1等" },
    isKakuhen: true,
    createdAt: 123,
  };

  it("当選者と賞品の両方が画面に見えるまでは保存しない(ネタバレ防止)", () => {
    const t = new RevealTracker();
    expect(revealableDrawId(result, t)).toBeNull();
    t.onAction("stopMemberDraw");
    expect(revealableDrawId(result, t)).toBeNull();
    t.onAction("stopPrizeDraw");
    expect(revealableDrawId(result, t)).toBe("d1");
  });

  it("確変の最終抽選でも公開済みになり、次の抽選に進む(reset)と保存しない", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    t.onAction("stopKakuhenDummyDraw");
    expect(revealableDrawId(result, t)).toBeNull();
    t.onAction("stopKakuhenFinalDraw");
    expect(revealableDrawId(result, t)).not.toBeNull();
    t.reset();
    expect(revealableDrawId(result, t)).toBeNull();
  });

  it("結果が無い・当選者や賞品が無いときは null", () => {
    const t = new RevealTracker();
    t.onAction("stopMemberDraw");
    t.onAction("stopPrizeDraw");
    expect(revealableDrawId(null, t)).toBeNull();
    expect(revealableDrawId({ ...result, wonMember: null }, t)).toBeNull();
    expect(revealableDrawId({ ...result, wonPrize: null }, t)).toBeNull();
  });
});
