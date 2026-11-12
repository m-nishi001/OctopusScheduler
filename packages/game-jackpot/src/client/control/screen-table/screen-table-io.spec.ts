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
    repo = new JackpotRepository({} as never);
  });

  async function seed() {
    await repo.updateScreenSettings(
      [
        setting("opening", "opening-screen-settings", {
          bgm: "o.mp3",
          contents: [{ type: "text", text: "ようこそ", effect: "fade", duration: 2500, se: "se.wav" }, { type: "image", media: "pic.png", effect: "static", duration: 1000 }],
        }),
        setting("demo", "demo-screen-settings", { demoBgm: "o.mp3", demoDrawSe: "se.wav" }),
        setting("main", "main-screen-settings", { memberLotteryBgms: ["o.mp3", "se.wav"], kakuhenMode: "fixed", kakuhenFixedTimings: [2, 5], prizeStopSec: 8 }),
        setting("result", "result-screen-settings", { resultBgm: "se.wav" }),
      ],
      new Map([["o.mp3", file("o.mp3", "BGM")], ["se.wav", file("se.wav", "SE", "audio/wav")], ["pic.png", file("pic.png", "IMG", "image/png")]])
    );
  }

  it("書き出した ZIP / CSV をそのまま取り込むと、全行が変更なし。ZIP の素材は参照されているものを1つずつ", async () => {
    await seed();
    const zip = await exportScreens(repo, { includeMedia: true });
    expect(zip.filename).toBe("screens.zip");
    expect([...readZip(zip.bytes).media.keys()].sort()).toEqual(["o.mp3", "pic.png", "se.wav"]);
    const p1 = await previewScreenImport({ table: new File([zip.bytes as BlobPart], "screens.zip"), media: [], mode: "upsert" }, { repo });
    expect(p1).toMatchObject({ ok: true, counts: { unchanged: 10, add: 0, update: 0, error: 0 }, media: { added: 0, replaced: 0 } });
    const csv = await exportScreens(repo, { includeMedia: false });
    expect(csv.filename).toBe("screens.csv");
    const p2 = await previewScreenImport({ table: csvFile(new TextDecoder().decode(csv.bytes)), media: [], mode: "upsert" }, { repo });
    expect(p2).toMatchObject({ ok: true, counts: { unchanged: 10, update: 0, error: 0 } });
  });

  it("まっさらな状態に取り込むと、画面が追加され(書き込みは1回)、素材も入る。書き出し直すと同じ", async () => {
    await seed();
    const out = await exportScreens(repo, { includeMedia: true });
    const text = new TextDecoder().decode(readZip(out.bytes).csv!);
    await new LocalStorageService("jackpot-game", "JackpotData").clear();
    await new LocalStorageService("jackpot-game-blobs", "Blobs").clear();
    const fresh = new JackpotRepository({} as never);
    const update = vi.spyOn(fresh, "updateScreenSettings");
    const preview = await previewScreenImport({ table: new File([out.bytes as BlobPart], "screens.zip"), media: [], mode: "upsert" }, { repo: fresh });
    expect(preview).toMatchObject({ ok: true, counts: { add: 10, update: 0, unchanged: 0, error: 0 }, media: { added: 3, replaced: 0 } });
    if (!preview.ok) return;
    const result = await preview.apply(() => undefined);
    expect(result.summary).toBe("追加 10 / 更新 0 / 変更なし 0");
    expect(update).toHaveBeenCalledTimes(1);
    const record = await fresh.readRecord();
    expect(record.screens.map((s) => s.screenName).sort()).toEqual(["demo", "main", "opening", "result"]);
    expect(Object.keys(record.media).sort()).toEqual(["o.mp3", "pic.png", "se.wav"]);
    const back = await exportFrom({ readRecord: () => fresh.readRecord(), updateScreenSettings: (...a) => fresh.updateScreenSettings(...a), blobOf: async (n) => created.get(n) ?? null }, { includeMedia: false });
    expect(new TextDecoder().decode(back.bytes).replace(/^\uFEFF/, "")).toBe(text.replace(/^\uFEFF/, ""));
  });

  it("ファイルに出てくる画面だけを置き換え、出てこない画面は変えない。変えた行の画面だけが更新になる", async () => {
    await seed();
    const csv = "画面,項目,素材\n最終結果,BGM,o.mp3\n";
    const preview = await previewScreenImport({ table: csvFile(csv), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { update: 1, unchanged: 0, error: 0 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    const record = await repo.readRecord();
    expect(JSON.parse(record.screens.find((s) => s.screenName === "result")!.settingValue)).toEqual({ resultBgm: "o.mp3" });
    expect(JSON.parse(record.screens.find((s) => s.screenName === "demo")!.settingValue)).toEqual({ demoBgm: "o.mp3", demoDrawSe: "se.wav" });
    expect(record.screens).toHaveLength(4);
  });

  it("同じ名前で中身が違う素材は差し替えになり、それを使う画面の行は更新になる", async () => {
    await seed();
    const csv = new TextDecoder().decode((await exportScreens(repo, { includeMedia: false })).bytes);
    const preview = await previewScreenImport({ table: csvFile(csv), media: [file("se.wav", "CHANGED-SE!", "audio/wav")], mode: "upsert" }, { repo });
    if (!preview.ok) throw new Error("preview");
    expect(preview.media).toEqual({ added: 0, replaced: 1 });
    // se.wav を使うのは オープニング・デモ・本抽選・最終結果 の4画面(10行すべてがこの4画面の行)
    expect(preview.counts.update).toBe(10);
    await preview.apply(() => undefined);
    expect((await repo.readRecord()).media["se.wav"].size).toBe(11);
  });

  it("エラーの行があると取り込めず、何も書かない(素材が無い・項目が違う)", async () => {
    const preview = await previewScreenImport({ table: csvFile("画面,項目,素材\n最終結果,BGM,none.mp3\nホーム,BGM,\n"), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { error: 2 } });
    if (!preview.ok) return;
    expect(preview.rows[0].message).toContain("「none.mp3」が見つかりません");
    await expect(preview.apply(() => undefined)).rejects.toThrow("エラーの行");
    expect((await repo.readRecord()).screens).toEqual([]);
  });

  it("取込を確定すると afterImport が呼ばれる。書き出しは保存の関数に渡される。CSV でないファイルは段階でエラー", async () => {
    const afterImport = vi.fn(async () => undefined);
    const save = vi.fn();
    const io = screenTableIo({ repo, afterImport, save });
    const preview = await io.onPreviewImport({ table: csvFile("画面,項目,素材,文字\n本抽選,確変の回,,おまかせ\n"), media: [], mode: "upsert" });
    if (!preview.ok) throw new Error("preview");
    await preview.apply(() => undefined);
    expect(afterImport).toHaveBeenCalledOnce();
    await io.onExport({ includeMedia: false });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ filename: "screens.csv" }));
    expect(await previewScreenImport({ table: new File(["not a zip"], "x.zip"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
    expect(await previewScreenImport({ table: csvFile("ID,メモ\n1,a\n"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
  });
});
