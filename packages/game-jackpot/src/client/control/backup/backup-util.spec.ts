import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { BACKUP_ASSET_STORE, BACKUP_STORES, buildLocalBackup, toJsonSafe } from "./backup-util";

/**
 * バックアップは、IndexedDB（localforage）のデータを書き出す。
 * 以前は localStorage の `jackpot-` のキーだけを書き出していたので、実データは1つも入らなかった。
 */

const store = (name: string) => new LocalStorageService("jackpot-game", name);

beforeEach(async () => {
  for (const name of [...BACKUP_STORES, BACKUP_ASSET_STORE]) await store(name).clear();
});

describe("buildLocalBackup", () => {
  it("景品・メンバーの設定・画面設定を書き出す(一覧全体を1件の record として、更新日時つきで)", async () => {
    await store("PrizeData").save("record", { data: [{ id: "p1", name: "1等", order: 1 }], updatedAt: 111 });
    await store("MemberExtraData").save("record", { data: [{ memberId: "m1", rank: 3 }], updatedAt: 222 });
    await store("ScreenConfigData").save("record", { data: [{ screenName: "opening", settingValue: "{}" }], updatedAt: 333 });

    const backup = await buildLocalBackup(false);

    expect(Object.keys(backup.stores).sort()).toEqual([...BACKUP_STORES].sort());
    // 一覧の中身と、同期の更新日時がそのまま入っている
    expect(JSON.stringify(backup.stores.PrizeData.record)).toContain("1等");
    expect(JSON.stringify(backup.stores.PrizeData.record)).toContain('"updatedAt":111');
    expect(JSON.stringify(backup.stores.MemberExtraData.record)).toContain('"rank":3');
    expect(JSON.stringify(backup.stores.ScreenConfigData.record)).toContain("opening");
    // 抽選結果と確変の予定はセッションの結果ファイル(サーバー)にあり、ローカルのバックアップには含めない
    expect(backup.stores.DrawResultData).toBeUndefined();
    expect(backup.stores.PrizeDrawState).toBeUndefined();
  });

  // jsdom の localforage は Blob を保存して読み戻せない（{} になる）ので、Blob をデータURLに直す部分は toJsonSafe のテストで確かめる。
  it("アセットは includeAssets のときだけ書き出す", async () => {
    await store("AssetData").save("a1", { id: "a1", name: "bgm.mp3" });

    const without = await buildLocalBackup(false);
    expect(without.stores[BACKUP_ASSET_STORE]).toBeUndefined();

    const withAssets = await buildLocalBackup(true);
    expect(JSON.stringify(withAssets.stores[BACKUP_ASSET_STORE].a1)).toContain("bgm.mp3");
  });

  it("データが無くても、空のストアとして書き出せる（落ちない）", async () => {
    const backup = await buildLocalBackup(true);
    expect(backup.stores.PrizeData).toEqual({});
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
