import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { readZip } from "@octopus/table-io";
import { installMediaTestEnv } from "../../testing/media-test-utils";
import { JackpotRepository } from "../../model/jackpot-repository";
import type { ScreenSettingRecord } from "../../../server/jackpot-api-contract";
import { exportScreens as exportFrom, previewScreenImport, screenTableIo } from "./screen-table-io";

installMediaTestEnv();

vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:image/png;base64,QUJD",
}));

/** このテストで作ったファイル。jsdom では端末の置き場から読み戻した Blob が本物ではなくなるので、書き出しではここから返す。 */
const created = new Map<string, File>();
const file = (name: string, text: string, type = "audio/mpeg") => {
  const f = new File([text], name, { type });
  created.set(name, f);
  return f;
};
const csvFile = (text: string, name = "screens.csv") => new File([text], name, { type: "text/csv" });
const setting = (screenName: string, settingName: string, value: unknown): ScreenSettingRecord => ({ screenName, settingName, settingValue: JSON.stringify(value) });

describe("画面設定の書き出し・取込", () => {
  let repo: JackpotRepository;
  const exportScreens = (r: JackpotRepository, options: { includeMedia: boolean }) =>
    exportFrom({ readRecord: () => r.readRecord(), updateScreenSettings: (...a) => r.updateScreenSettings(...a), blobOf: async (name) => created.get(name) ?? null }, options);

  beforeEach(async () => {
    created.clear();
    await new LocalStorageService("jackpot-game", "JackpotData").clear();
    await new LocalStorageService("jackpot-game-blobs", "Blobs").clear();
    repo = new JackpotRepository({} as never, {} as never);
  });

  async function seed() {
    await repo.updateScreenSettings(
      [
        setting("opening", "opening-screen-settings", {
          bgm: "o.mp3",
          items: [{ kind: "テキスト", text: "ようこそ", effect: "フェード", seconds: 2.5, se: "se.wav" }, { kind: "画像", image: "pic.png", effect: "静止", seconds: 1 }],
        }),
        setting("demo", "demo-screen-settings", { enabled: true, rounds: 2, bgm: "o.mp3" }),
        setting("main", "main-screen-settings", { memberLotteryBgms: ["o.mp3", "se.wav"], kakuhenMode: "fixed", kakuhenFixedTimings: [2, 5], prizeStopSec: 8, participantStop: false }),
        setting("result", "result-screen-settings", { resultBgm: "se.wav" }),
      ],
      new Map([["o.mp3", file("o.mp3", "BGM")], ["se.wav", file("se.wav", "SE", "audio/wav")], ["pic.png", file("pic.png", "IMG", "image/png")]])
    );
  }

  const zipFile = (bytes: Uint8Array) => new File([bytes as BlobPart], "screens.zip");

  it("書き出しは screens.zip(screens.csv と pages.csv)。素材つきなら参照されている素材を1つずつ media/ に入れる。取り込むと全行が変更なし", async () => {
    await seed();
    const withMedia = await exportScreens(repo, { includeMedia: true });
    expect(withMedia.filename).toBe("screens.zip");
    const zip = readZip(withMedia.bytes);
    expect([...zip.csvs.keys()]).toEqual(["screens.csv", "pages.csv"]);
    expect([...zip.media.keys()].sort()).toEqual(["o.mp3", "pic.png", "se.wav"]);
    const p1 = await previewScreenImport({ table: zipFile(withMedia.bytes), media: [], mode: "upsert" }, { repo });
    expect(p1).toMatchObject({ ok: true, counts: { unchanged: 6, add: 0, update: 0, error: 0 }, media: { added: 0, replaced: 0 } });

    // 素材を含めない書き出しは、CSV の2つだけの ZIP。素材は既に登録済みなので、そのまま取り込める
    const noMedia = await exportScreens(repo, { includeMedia: false });
    expect(noMedia.filename).toBe("screens.zip");
    expect(readZip(noMedia.bytes).media.size).toBe(0);
    const p2 = await previewScreenImport({ table: zipFile(noMedia.bytes), media: [], mode: "upsert" }, { repo });
    expect(p2).toMatchObject({ ok: true, counts: { unchanged: 6, update: 0, error: 0 } });
  });

  it("まっさらな状態に取り込むと、画面が追加され(書き込みは1回)、素材も入る。書き出し直すと同じ CSV", async () => {
    await seed();
    const out = await exportScreens(repo, { includeMedia: true });
    const before = readZip(out.bytes).csvs;
    await new LocalStorageService("jackpot-game", "JackpotData").clear();
    await new LocalStorageService("jackpot-game-blobs", "Blobs").clear();
    const fresh = new JackpotRepository({} as never, {} as never);
    const update = vi.spyOn(fresh, "updateScreenSettings");
    const preview = await previewScreenImport({ table: zipFile(out.bytes), media: [], mode: "upsert" }, { repo: fresh });
    expect(preview).toMatchObject({ ok: true, counts: { add: 6, update: 0, unchanged: 0, error: 0 }, media: { added: 3, replaced: 0 } });
    if (!preview.ok) return;
    const result = await preview.apply(() => undefined);
    expect(result.summary).toBe("追加 6 / 更新 0 / 変更なし 0");
    expect(update).toHaveBeenCalledTimes(1);
    const record = await fresh.readRecord();
    expect(record.screens.map((s) => s.screenName).sort()).toEqual(["demo", "main", "opening", "result"]);
    expect(JSON.parse(record.screens.find((s) => s.screenName === "main")!.settingValue).participantStop).toBe(false);
    expect(Object.keys(record.media).sort()).toEqual(["o.mp3", "pic.png", "se.wav"]);
    const back = await exportFrom({ readRecord: () => fresh.readRecord(), updateScreenSettings: (...a) => fresh.updateScreenSettings(...a), blobOf: async (n) => created.get(n) ?? null }, { includeMedia: false });
    const after = readZip(back.bytes).csvs;
    for (const name of ["screens.csv", "pages.csv"]) {
      expect(new TextDecoder().decode(after.get(name)!).replace(/^\uFEFF/, "")).toBe(new TextDecoder().decode(before.get(name)!).replace(/^\uFEFF/, ""));
    }
  });

  it("CSV を1つだけ選んでも取り込める(見出しで screens.csv / pages.csv を見分ける)。screens.csv だけなら、ページはいまのまま", async () => {
    await seed();
    const csv = "画面,BGM\nオープニング,se.wav\n";
    const preview = await previewScreenImport({ table: csvFile(csv), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { update: 1, unchanged: 0, error: 0 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    const opening = JSON.parse((await repo.readRecord()).screens.find((s) => s.screenName === "opening")!.settingValue);
    expect(opening.bgm).toBe("se.wav");
    expect(opening.items).toHaveLength(2); // pages.csv を渡していないので、ページはいまのまま

    const pagesOnly = "画面,種類,文字\nオープニング,テキスト,新しい文\n";
    const p2 = await previewScreenImport({ table: csvFile(pagesOnly, "pages.csv"), media: [], mode: "upsert" }, { repo });
    expect(p2).toMatchObject({ ok: true, counts: { update: 1, error: 0 } });
    if (!p2.ok) return;
    await p2.apply(() => undefined);
    expect(JSON.parse((await repo.readRecord()).screens.find((s) => s.screenName === "opening")!.settingValue)).toMatchObject({ bgm: "se.wav", items: [{ text: "新しい文" }] });
  });

  it("ファイルに出てくる画面だけを置き換え、出てこない画面は変えない。変えた行の画面だけが更新になる", async () => {
    await seed();
    const csv = "画面,BGM\n最終結果,o.mp3\n";
    const preview = await previewScreenImport({ table: csvFile(csv), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { update: 1, unchanged: 0, error: 0 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    const record = await repo.readRecord();
    expect(JSON.parse(record.screens.find((s) => s.screenName === "result")!.settingValue)).toEqual({ resultBgm: "o.mp3" });
    expect(JSON.parse(record.screens.find((s) => s.screenName === "demo")!.settingValue)).toEqual({ enabled: true, rounds: 2, bgm: "o.mp3" });
    expect(record.screens).toHaveLength(4);
  });

  it("同じ名前で中身が違う素材は差し替えになり、それを使う画面の行は更新になる", async () => {
    await seed();
    const out = await exportScreens(repo, { includeMedia: false });
    const preview = await previewScreenImport({ table: zipFile(out.bytes), media: [file("se.wav", "CHANGED-SE!", "audio/wav")], mode: "upsert" }, { repo });
    if (!preview.ok) throw new Error("preview");
    expect(preview.media).toEqual({ added: 0, replaced: 1 });
    // se.wav を使うのは オープニング(効果音)・本抽選(メンバー抽選BGM)・最終結果 の3画面(行は screens 3 + pages 2)。デモ抽選は使わない
    expect(preview.counts.update).toBe(5);
    expect(preview.counts.unchanged).toBe(1);
    await preview.apply(() => undefined);
    expect((await repo.readRecord()).media["se.wav"].size).toBe(11);
  });

  it("エラーの行があると取り込めず、何も書かない(素材が無い・画面が違う・旧形式)", async () => {
    const preview = await previewScreenImport({ table: csvFile("画面,BGM\n最終結果,none.mp3\nホーム,\n"), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { error: 2 } });
    if (!preview.ok) return;
    expect(preview.rows[0].message).toContain("「none.mp3」が見つかりません");
    await expect(preview.apply(() => undefined)).rejects.toThrow("エラーの行");
    expect((await repo.readRecord()).screens).toEqual([]);

    // 旧形式(縦長の 画面/項目/素材…)は、使えなくなったことを伝える
    const old = await previewScreenImport({ table: csvFile("画面,項目,素材,文字,種類\n最終結果,BGM,o.mp3,,\n"), media: [], mode: "upsert" }, { repo });
    expect(old.ok).toBe(false);
    if (!old.ok) expect(old.errors.join("\n")).toContain("使えなくなりました");
  });

  it("確変の回の数が確変対応ありの景品の数と違えば、取り込めるが、その行に注意が出る", async () => {
    await repo.addPrizes([{ id: "p1", name: "A", order: 1, rank: 3, kakuhen: true }]);
    const preview = await previewScreenImport({ table: csvFile("画面,確変の決め方,確変の回\n本抽選,回を指定,\"3, 7\"\n"), media: [], mode: "upsert" }, { repo });
    if (!preview.ok) throw new Error("preview");
    expect(preview.counts.error).toBe(0);
    expect(preview.rows[0].message).toContain("注意: 確変にする回（2回）が、確変対応ありの景品（1件）より多い");
  });

  it("取込を確定すると afterImport が呼ばれる。書き出しは保存の関数に渡される。CSV でないファイルは段階でエラー", async () => {
    const afterImport = vi.fn(async () => undefined);
    const save = vi.fn();
    const io = screenTableIo({ repo, afterImport, save });
    const preview = await io.onPreviewImport({ table: csvFile("画面,確変の決め方\n本抽選,おまかせ\n"), media: [], mode: "upsert" });
    if (!preview.ok) throw new Error("preview");
    await preview.apply(() => undefined);
    expect(afterImport).toHaveBeenCalledOnce();
    await io.onExport({ includeMedia: false });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ filename: "screens.zip" }));
    expect(await previewScreenImport({ table: new File(["not a zip"], "x.zip"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
    expect(await previewScreenImport({ table: csvFile("ID,メモ\n1,a\n"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
  });
});
