import { describe, expect, it } from "vitest";
import { JACKPOT_STAGES, parseJackpotStage, readJackpotState } from "../jackpot-state";

describe("readJackpotState(ホスト・管理端末・ポータルが共有する読み取り)", () => {
  it("公開された状態を、そのまま取り出す", () => {
    expect(readJackpotState({ jackpot: { page: "main-draw", stage: "member-revealed", canStop: false, busy: true, member: "太郎", memberId: "m1", prize: null } })).toEqual({
      page: "main-draw",
      stage: "member-revealed",
      canStop: false,
      busy: true,
      member: "太郎",
      memberId: "m1",
      prize: null,
    });
  });

  it("説明画面は、スライドの位置(index / total)も取り出す", () => {
    expect(readJackpotState({ jackpot: { page: "description", stage: "waiting", canStop: false, member: null, memberId: null, prize: null, index: -1, total: 4 } })).toMatchObject({
      page: "description",
      index: -1,
      total: 4,
    });
  });

  it("無い・オブジェクトでないときは null", () => {
    for (const data of [undefined, null, {}, { jackpot: "x" }, { jackpot: 1 }, { jackpot: [] }, { jackpot: null }]) {
      expect(readJackpotState(data as never)).toBeNull();
    }
  });

  it("項目の型が違えば、安全な既定値にする(壊れた状態でポータルを壊さない)", () => {
    expect(readJackpotState({ jackpot: { stage: 3, canStop: "yes", busy: "yes", member: 1, memberId: {}, prize: [], index: "0", total: NaN } })).toEqual({
      page: "main-draw",
      stage: "waiting",
      canStop: false,
      busy: false,
      member: null,
      memberId: null,
      prize: null,
    });
  });

  it("未知の場面は waiting として扱う。定義済みの場面はすべてそのまま通る", () => {
    expect(parseJackpotStage("something-new")).toBe("waiting");
    for (const stage of JACKPOT_STAGES) expect(readJackpotState({ jackpot: { stage } })?.stage).toBe(stage);
  });
});
