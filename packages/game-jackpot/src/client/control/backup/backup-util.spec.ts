import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { BACKUP_STORES, buildLocalBackup, toJsonSafe } from "./backup-util";

/**
 * バックアップは、IndexedDB（localforage）のデータを書き出す。
 * 以前は localStorage の `jackpot-` のキーだけを書き出していたので、実データは1つも入らなかった。
 */

const store = (name: string) => new LocalStorageService("jackpot-game", name);

beforeEach(async () => {
  for (const name of BACKUP_STORES) await store(name).clear();
});

describe("buildLocalBackup", () => {
  it("景品・画面設定・メンバーの設定を書き出す(全体を1件の record として、更新日時つきで)", async () => {
    await store("JackpotData").save("record", {
      data: { prizes: [{ id: "p1", name: "1等", order: 1 }], screens: [{ screenName: "opening", settingValue: "{}" }], media: {} },
      updatedAt: 111,
    });
    await store("MemberExtraData").save("record", { data: [{ memberId: "m1", rank: 3 }], updatedAt: 222 });

    const backup = await buildLocalBackup();

    expect(Object.keys(backup.stores).sort()).toEqual([...BACKUP_STORES].sort());
    // 一覧の中身と、同期の更新日時がそのまま入っている
    expect(JSON.stringify(backup.stores.JackpotData.record)).toContain("1等");
    expect(JSON.stringify(backup.stores.JackpotData.record)).toContain("opening");
    expect(JSON.stringify(backup.stores.JackpotData.record)).toContain('"updatedAt":111');
    expect(JSON.stringify(backup.stores.MemberExtraData.record)).toContain('"rank":3');
    // 抽選結果と確変の予定はセッションの結果ファイル(サーバー)にあり、ローカルのバックアップには含めない
    expect(backup.stores.DrawResultData).toBeUndefined();
    expect(backup.stores.PrizeDrawState).toBeUndefined();
  });

  it("データが無くても、空のストアとして書き出せる（落ちない）", async () => {
    const backup = await buildLocalBackup();
    expect(backup.stores.JackpotData).toEqual({});
    expect(typeof backup.exportedAt).toBe("string");
    expect(() => JSON.stringify(backup)).not.toThrow();
  });
});

describe("toJsonSafe", () => {
  it("入れ子の中の Blob も直し、それ以外の値はそのまま", async () => {
    const out = await toJsonSafe({ a: [1, { b: new Blob(["x"], { type: "image/png" }) }], c: "text", d: null });
    expect(out).toEqual({ a: [1, { b: { __blob: true, type: "image/png", dataUrl: "data:image/png;base64,eA==" } }], c: "text", d: null });
  });
});
