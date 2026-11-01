import "reflect-metadata";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { FixedConcurrencyPolicy, InMemoryKeyValueStorage } from "@octopus/infrastructures/testing";
import { createHashedBlobStore, StorageModule } from "@octopus/infrastructures/compositions";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { SyncRunner, hashBlob } from "@octopus/sync-engine";
import { installMediaTestEnv } from "../testing/media-test-utils";
import { JackpotRepository } from "./jackpot-repository";
import { JACKPOT_RECORD_FILE, jackpotRecordHashes } from "../../server/jackpot-api-contract";
import type { Prize, ScreenSettingRecord } from "../../server/jackpot-api-contract";

installMediaTestEnv();

// jsdom + localforage では保存した Blob を読み戻すと本物の Blob ではなくなり FileReader で読めないので、データURL化だけ差し替える
vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:audio/mpeg;base64,QUJD",
}));

/** サーバーの実装(ハッシュのファイル置き場とレコードの保存)をそのまま使う、メモリ上のサーバー。 */
function makeServer() {
  const store = createHashedBlobStore(StorageModule.Jackpot);
  const deps = { storage: new InMemoryKeyValueStorage() };
  const api = {
    getRecord: async () => store.getRecord(deps, { fileName: JACKPOT_RECORD_FILE }),
    saveRecord: async (a: { json: string }) => store.saveRecord(deps, { fileName: JACKPOT_RECORD_FILE, json: a.json }, jackpotRecordHashes),
    existsBlobs: async (a: { hashes: string[] }) => store.exists(deps, a),
    putBlob: async (a: { hash: string; dataUrl: string }) => store.put(deps, a),
    getBlob: async (a: { hash: string }) => store.get(deps, a),
    addJson: async () => undefined,
    getJson: async () => ({ json: null }),
  };
  /** サーバーに残っているハッシュのファイルの数。 */
  const blobCount = async () => (await deps.storage.listByPrefix("jackpot-game/assets/")).length;
  return { api, blobCount };
}

const prize = (id: string, extra: Partial<Prize> = {}): Prize => ({ id, name: id, order: 1, ...extra });
const screen = (name: string, value: object): ScreenSettingRecord => ({ screenName: name, settingName: `${name}-settings`, settingValue: JSON.stringify(value) });
const png = (text: string) => new File([text], "ignored.png", { type: "image/png" });
const mp3 = (text: string) => new Blob([text], { type: "audio/mpeg" });
const files = (entries: Record<string, Blob>) => new Map(Object.entries(entries));

async function clearLocal() {
  await new LocalStorageService("jackpot-game", "JackpotData").clear();
  await new LocalStorageService("jackpot-game-blobs", "Blobs").clear();
}

const runner = new SyncRunner(new FixedConcurrencyPolicy(5));
const sync = async (repo: JackpotRepository) => {
  const results = (await runner.run(await repo.listSyncTargets())).results;
  for (const r of results) expect(r.error).toBeUndefined();
  return results;
};

describe("JackpotRepository", () => {
  let server: ReturnType<typeof makeServer>;
  let repo: JackpotRepository;

  beforeEach(async () => {
    await clearLocal();
    server = makeServer();
    repo = new JackpotRepository(server.api as never);
  });

  it("景品の追加・上書き・削除ができ、景品と画面設定は1件のレコードに入る", async () => {
    await repo.addPrizes([prize("p1", { name: "A" })]);
    await repo.addPrizes([prize("p2", { name: "B", order: 2 }), prize("p1", { name: "A2" })]);
    expect((await repo.getPrizes()).map((p) => [p.id, p.name])).toEqual([["p1", "A2"], ["p2", "B"]]);
    expect((await repo.getPrizeById("p2"))!.name).toBe("B");
    expect(await repo.getPrizeById("none")).toBeNull();

    await repo.updateScreenSettings([screen("demo", { demoBgm: "" })]);
    expect((await repo.getScreenSettingsByType("demo")).map((s) => s.settingName)).toEqual(["demo-settings"]);
    expect((await repo.readRecord()).prizes).toHaveLength(2);

    await repo.deletePrizes(["p1"]);
    expect((await repo.getPrizes()).map((p) => p.id)).toEqual(["p2"]);
    expect(await repo.getScreenSettings()).toHaveLength(1);
  });

  it("素材は名前で参照され、名前から中身を引ける。同じ名前は1つだけ保存される", async () => {
    await repo.addPrizes([prize("p1", { image: "a.png" }), prize("p2", { image: "a.png", bgm1: "b.mp3" })], files({ "a.png": png("one"), "b.mp3": mp3("bgm") }));
    const { media } = await repo.readRecord();
    expect(Object.keys(media).sort()).toEqual(["a.png", "b.mp3"]);
    expect(media["a.png"]).toMatchObject({ mime: "image/png", size: 3 });
    expect(media["a.png"].hash).toBe(await hashBlob(png("one")));
    expect(await repo.blobOf("a.png")).not.toBeNull();
    expect(await repo.blobOf("none.png")).toBeNull();
    expect(await repo.blobOf(undefined)).toBeNull();
  });

  describe("素材の索引は保存のたびに作り直す", () => {
    it("景品と画面設定が共有している素材は、景品を消しても残り、どちらも参照しなくなると消える", async () => {
      await repo.addPrizes([prize("p1", { bgm1: "shared.mp3" })], files({ "shared.mp3": mp3("s") }));
      await repo.updateScreenSettings([screen("demo", { demoBgm: "shared.mp3" })]);
      expect(Object.keys((await repo.readRecord()).media)).toEqual(["shared.mp3"]);

      await repo.deletePrizes(["p1"]);
      expect(Object.keys((await repo.readRecord()).media)).toEqual(["shared.mp3"]);
      expect(await repo.blobOf("shared.mp3")).not.toBeNull();

      await repo.updateScreenSettings([screen("demo", { demoBgm: "" })]);
      expect((await repo.readRecord()).media).toEqual({});
      expect(await repo.blobOf("shared.mp3")).toBeNull();
    });

    it("画面設定の入れ子(コンテンツの画像・効果音、BGM の一覧)の参照も数える", async () => {
      await repo.updateScreenSettings(
        [screen("opening", { bgm: "o.mp3", contents: [{ type: "image", media: "i.png", se: "se.mp3" }, { type: "text" }] }), screen("main", { memberLotteryBgms: ["m1.mp3", ""] })],
        files({ "o.mp3": mp3("1"), "i.png": png("2"), "se.mp3": mp3("3"), "m1.mp3": mp3("4"), "unused.mp3": mp3("5") })
      );
      expect(Object.keys((await repo.readRecord()).media).sort()).toEqual(["i.png", "m1.mp3", "o.mp3", "se.mp3"]);
    });

    it("同じ名前で別の中身のファイルを渡すと、その名前の素材を差し替える", async () => {
      await repo.addPrizes([prize("p1", { image: "a.png" })], files({ "a.png": png("old") }));
      const before = (await repo.readRecord()).media["a.png"].hash;
      await repo.addPrizes([prize("p2", { image: "a.png" })], files({ "a.png": png("newer!") }));
      const after = (await repo.readRecord()).media["a.png"];
      expect(after.hash).not.toBe(before);
      expect(after.size).toBe(6);
    });

    it("参照先の素材が無い保存は、何も書かずに断る(参照切れは作れない)", async () => {
      await repo.addPrizes([prize("p1")]);
      await expect(repo.addPrizes([prize("p2", { image: "missing.png" })])).rejects.toThrow("missing.png");
      await expect(repo.updateScreenSettings([screen("demo", { demoBgm: "missing.mp3" })])).rejects.toThrow("missing.mp3");
      const record = await repo.readRecord();
      expect(record.prizes.map((p) => p.id)).toEqual(["p1"]);
      expect(record.screens).toEqual([]);
    });
  });

  it("applyPrizeImport は景品の全部を置き換え、素材を入れてレコードを1回だけ書く", async () => {
    await repo.addPrizes([prize("old", { image: "gone.png" })], files({ "gone.png": png("g") }));
    const hash = await hashBlob(png("new"));
    await repo.applyPrizeImport([prize("n1", { image: "new.png" }), prize("n2", { order: 2 })], new Map([["new.png", { blob: png("new"), hash }]]));
    const record = await repo.readRecord();
    expect(record.prizes.map((p) => p.id)).toEqual(["n1", "n2"]);
    expect(Object.keys(record.media)).toEqual(["new.png"]);
    expect(record.media["new.png"].hash).toBe(hash);
  });

  it("以前の形式(配列)のレコードは、空のレコードとして扱う", async () => {
    await new LocalStorageService("jackpot-game", "JackpotData").save("record", { data: [{ id: "old" }], updatedAt: 1 });
    expect(await repo.readRecord()).toEqual({ prizes: [], screens: [], media: {} });
    await repo.addPrizes([prize("p1")]);
    expect((await repo.getPrizes()).map((p) => p.id)).toEqual(["p1"]);
  });

  describe("同期", () => {
    it("サーバーにファイルとレコードが上がり、景品を消して同期するとサーバーのファイルも消える", async () => {
      await repo.addPrizes([prize("p1", { image: "a.png", bgm1: "b.mp3" })], files({ "a.png": png("one"), "b.mp3": mp3("two") }));
      expect((await sync(repo)).map((r) => r.result)).toEqual(["pushed"]);
      expect(await server.blobCount()).toBe(2);

      await repo.deletePrizes(["p1"]);
      await sync(repo);
      expect(await server.blobCount()).toBe(0);
      expect(JSON.parse((await server.api.getRecord()).json!).data).toEqual({ prizes: [], screens: [], media: {} });
      await sync(repo);
      expect(await repo.getPrizes()).toEqual([]);
    });

    it("別の端末が、レコードと素材の中身を取り込む", async () => {
      await repo.addPrizes([prize("p1", { image: "a.png" })], files({ "a.png": png("one") }));
      await repo.updateScreenSettings([screen("demo", { demoBgm: "a.png" })]);
      await sync(repo);

      await clearLocal();
      const other = new JackpotRepository(server.api as never);
      expect((await sync(other)).map((r) => r.result)).toEqual(["pulled"]);
      expect((await other.getPrizes()).map((p) => p.id)).toEqual(["p1"]);
      expect(await other.blobOf("a.png")).not.toBeNull();
    });

    it("サーバーにファイルだけが残っていても、素材は現れない", async () => {
      await server.api.putBlob({ hash: "e".repeat(32), dataUrl: "data:audio/mpeg;base64,QUJD" });
      await sync(repo);
      expect((await repo.readRecord()).media).toEqual({});
    });

    it("サーバーの古い形式(配列)のレコードは参照を持たないものとして扱う", () => {
      expect(jackpotRecordHashes([{ id: "old", hash: "e".repeat(32) }])).toEqual([]);
    });
  });
});
