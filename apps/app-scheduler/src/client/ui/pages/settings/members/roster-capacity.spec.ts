import { describe, expect, it } from "vitest";
import { describeRosterCapacity } from "./roster-capacity";

describe("describeRosterCapacity", () => {
  it("上限の無い保存先(Cloudflare)では何も出さない", () => {
    expect(describeRosterCapacity({ members: 500, usedBytes: 30_000, maxBytes: null })).toBeNull();
  });

  it("余裕があるうちは、使用状況だけを出す", () => {
    const view = describeRosterCapacity({ members: 50, usedBytes: 3_000, maxBytes: 9_000 });
    expect(view).toEqual({ percent: 33, level: "ok", message: "名簿の容量: 33% 使用中(50人)" });
  });

  it("80%を超えたら、上限が近いと警告し、あと何人ほどかを伝える", () => {
    const view = describeRosterCapacity({ members: 120, usedBytes: 7_500, maxBytes: 9_000 });
    expect(view?.level).toBe("warn");
    expect(view?.message).toContain("上限が近づいています");
    expect(view?.message).toContain("あと24人ほど"); // 1人 62.5B → (9000-7500)/62.5
  });

  it("80%ちょうどから警告になる", () => {
    expect(describeRosterCapacity({ members: 100, usedBytes: 7_200, maxBytes: 9_000 })?.level).toBe("warn");
    expect(describeRosterCapacity({ members: 100, usedBytes: 7_199, maxBytes: 9_000 })?.level).toBe("ok");
  });

  it("95%を超えたら、登録できなくなる前に整理するよう強く促す", () => {
    const view = describeRosterCapacity({ members: 140, usedBytes: 8_700, maxBytes: 9_000 });
    expect(view?.level).toBe("full");
    expect(view?.message).toContain("登録できなくなります");
  });

  it("名簿が空でも壊れない", () => {
    expect(describeRosterCapacity({ members: 0, usedBytes: 2, maxBytes: 9_000 })).toEqual({ percent: 0, level: "ok", message: "名簿の容量: 0% 使用中(0人)" });
  });
});
