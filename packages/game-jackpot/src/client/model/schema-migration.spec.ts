import { describe, expect, it } from "vitest";
import type { JackpotRecord } from "../../server/jackpot-api-contract";
import { JACKPOT_SCHEMA_VERSION, migrateJackpotRecord, migrateMemberExtraData } from "./schema-migration";

describe("migrateJackpotRecord", () => {
  const legacy = {
    prizes: [
      { id: "a", name: "A", order: 1, weight: 80, animation: "slot", image: "a.png" },
      { id: "b", name: "B", order: 2, weight: 1 },
    ],
    screens: [{ screenName: "s", settingName: "n", settingValue: "{}" }],
    media: { "a.png": { hash: "h", mime: "image/png", size: 1 } },
  } as unknown as JackpotRecord;

  it("版が無い記録は、景品ランクをすべて3にして古い weight を捨て、版を付ける。ほかの項目は変えない", () => {
    const { record, changed } = migrateJackpotRecord(legacy);
    expect(changed).toBe(true);
    expect(record.schemaVersion).toBe(JACKPOT_SCHEMA_VERSION);
    expect(record.prizes).toEqual([
      { id: "a", name: "A", order: 1, rank: 3, animation: "slot", image: "a.png" },
      { id: "b", name: "B", order: 2, rank: 3 },
    ]);
    expect(record.screens).toEqual(legacy.screens);
    expect(record.media).toEqual(legacy.media);
  });

  it("古い版の数字でも移行する", () => {
    expect(migrateJackpotRecord({ ...legacy, schemaVersion: 0 }).changed).toBe(true);
  });

  it("元の記録は書き換えない", () => {
    migrateJackpotRecord(legacy);
    expect(legacy.schemaVersion).toBeUndefined();
    expect((legacy.prizes[0] as unknown as { weight: number }).weight).toBe(80);
  });

  it("2回目以降は何もしない(景品ランクの編集は消えない)", () => {
    const first = migrateJackpotRecord(legacy).record;
    const edited: JackpotRecord = { ...first, prizes: first.prizes.map((p) => ({ ...p, rank: 5 })) };
    const second = migrateJackpotRecord(edited);
    expect(second.changed).toBe(false);
    expect(second.record).toBe(edited);
    expect(second.record.prizes.map((p) => p.rank)).toEqual([5, 5]);
  });
});

describe("migrateMemberExtraData", () => {
  it("以前の配列形式は、当選しやすさをすべて5にして rank を捨て、版つきの形にする", () => {
    const { data, changed } = migrateMemberExtraData([
      { memberId: "m1", rank: 2, weight: 80 },
      { memberId: "m2", rank: 9 },
    ]);
    expect(changed).toBe(true);
    expect(data).toEqual({
      schemaVersion: JACKPOT_SCHEMA_VERSION,
      extras: [
        { memberId: "m1", weight: 5 },
        { memberId: "m2", weight: 5 },
      ],
    });
  });

  it("版の無いオブジェクトも移行する", () => {
    const { data, changed } = migrateMemberExtraData({ extras: [{ memberId: "m1", weight: 9 }] });
    expect(changed).toBe(true);
    expect(data.extras).toEqual([{ memberId: "m1", weight: 5 }]);
  });

  it("まだ何も保存されていなければ、空で現在の版(保存し直す必要は無い)", () => {
    expect(migrateMemberExtraData(null)).toEqual({ data: { schemaVersion: JACKPOT_SCHEMA_VERSION, extras: [] }, changed: false });
    expect(migrateMemberExtraData(undefined).changed).toBe(false);
  });

  it("2回目以降は何もしない(編集した当選しやすさは消えない)", () => {
    const first = migrateMemberExtraData([{ memberId: "m1", rank: 1, weight: 80 }]).data;
    const edited = { ...first, extras: [{ memberId: "m1", weight: 9 }] };
    const second = migrateMemberExtraData(edited);
    expect(second.changed).toBe(false);
    expect(second.data.extras).toEqual([{ memberId: "m1", weight: 9 }]);
    // 二度かけても同じ
    expect(migrateMemberExtraData(migrateMemberExtraData([{ memberId: "m1", weight: 80 }]).data).data).toEqual(
      migrateMemberExtraData([{ memberId: "m1", weight: 80 }]).data
    );
  });

  it("壊れた行は捨てる", () => {
    expect(migrateMemberExtraData([null, { weight: 3 }, { memberId: "m1" }]).data.extras).toEqual([{ memberId: "m1", weight: 5 }]);
  });
});
