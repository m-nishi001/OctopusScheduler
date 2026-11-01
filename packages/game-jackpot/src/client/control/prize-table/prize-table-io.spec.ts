import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalStorageService } from "@octopus/client-common/storage/local-storage-service";
import { readZip } from "@octopus/table-io";
import { installMediaTestEnv } from "../../testing/media-test-utils";
import { JackpotRepository } from "../../model/jackpot-repository";
import type { Prize } from "../../../server/jackpot-api-contract";
import { exportPrizes as exportFrom, previewPrizeImport, prizeTableIo } from "./prize-table-io";

installMediaTestEnv();

vi.mock("@octopus/client-common/blob/blob-to-data-url", () => ({
  blobToDataUrl: async () => "data:image/png;base64,QUJD",
}));

/** このテストで作ったファイル。jsdom では端末の置き場から読み戻した Blob が本物ではなくなるので、書き出しではここから返す。 */
const created = new Map<string, File>();
const file = (name: string, text: string, type = "image/png") => {
  const f = new File([text], name, { type });
  created.set(name, f);
  return f;
};
const csvFile = (text: string, name = "prizes.csv") => new File([text], name, { type: "text/csv" });
const prize = (id: string, extra: Partial<Prize> = {}): Prize => ({ id, name: `景品${id}`, order: 1, ...extra });

describe("景品の書き出し・取込", () => {
  let repo: JackpotRepository;
  const exportPrizes = (r: JackpotRepository, options: { includeMedia: boolean }) =>
    exportFrom({ readRecord: () => r.readRecord(), applyPrizeImport: (...a) => r.applyPrizeImport(...a), blobOf: async (name) => created.get(name) ?? null }, options);

  beforeEach(async () => {
    created.clear();
    await new LocalStorageService("jackpot-game", "JackpotData").clear();
    await new LocalStorageService("jackpot-game-blobs", "Blobs").clear();
    repo = new JackpotRepository({} as never);
  });

  /** 10件の景品が同じ画像を使う一覧を作る。 */
  async function seedShared() {
    await repo.addPrizes(
      Array.from({ length: 10 }, (_, i) => prize(`p${i + 1}`, { order: i + 1, image: "shared.png", bgm1: i % 2 ? "even.wav" : undefined })),
      new Map([["shared.png", file("shared.png", "IMG")], ["even.wav", file("even.wav", "WAV", "audio/wav")]])
    );
  }

  it("同じ画像を10件が使っていても、素材の索引は1つで、ZIP の素材も1つ。景品は並び順で書き出す", async () => {
    await seedShared();
    const out = await exportPrizes(repo, { includeMedia: true });
    const zip = readZip(out.bytes);
    expect([...zip.media.keys()].sort()).toEqual(["even.wav", "shared.png"]);
    expect(out.filename).toBe("prizes.zip");
    expect(out.missingMedia).toBe(0);
    const text = new TextDecoder().decode(zip.csv!);
    expect(text.match(/shared\.png/g)).toHaveLength(10);
    expect(text.indexOf("景品p1,")).toBeLessThan(text.indexOf("景品p2,"));
  });

  it("書き出した ZIP / CSV をそのまま取り込むと、全行が変更なし(置き換えでも)", async () => {
    await seedShared();
    const zip = await exportPrizes(repo, { includeMedia: true });
    const p1 = await previewPrizeImport({ table: new File([zip.bytes as BlobPart], "prizes.zip"), media: [], mode: "replace" }, { repo });
    expect(p1).toMatchObject({ ok: true, counts: { unchanged: 10, add: 0, update: 0, delete: 0, error: 0 }, media: { added: 0, replaced: 0 } });
    const csv = await exportPrizes(repo, { includeMedia: false });
    const p2 = await previewPrizeImport({ table: csvFile(new TextDecoder().decode(csv.bytes)), media: [], mode: "replace" }, { repo });
    expect(p2).toMatchObject({ ok: true, counts: { unchanged: 10 } });
  });

  it("新しい行と素材を取り込むと、レコードの書き込みは1回で、素材は1つ。追加は末尾に並ぶ", async () => {
    await repo.addPrizes([prize("old", { order: 4 })]);
    const rows = Array.from({ length: 10 }, (_, i) => `,新${i},5,スロット,pic.png`).join("\n");
    const apply = vi.spyOn(repo, "applyPrizeImport");
    const preview = await previewPrizeImport({ table: csvFile(`ID,名前,当選確率の重み,アニメーション,画像1\n${rows}\n`), media: [file("pic.png", "ONE")], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { add: 10 }, media: { added: 1, replaced: 0 } });
    if (!preview.ok) return;
    const result = await preview.apply(() => undefined);
    expect(result.summary).toBe("追加 10 / 更新 0 / 変更なし 0 / 削除 0");
    expect(apply).toHaveBeenCalledTimes(1);
    const record = await repo.readRecord();
    expect(record.prizes).toHaveLength(11);
    expect(record.prizes.map((p) => p.order)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    expect(Object.keys(record.media)).toEqual(["pic.png"]);
  });

  it("エラーの行があると、取り込めない(反映もしない)", async () => {
    const preview = await previewPrizeImport({ table: csvFile("ID,名前,画像1\n,T,missing.png\n"), media: [], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { error: 1 } });
    if (!preview.ok) return;
    await expect(preview.apply(() => undefined)).rejects.toThrow();
    expect((await repo.readRecord()).prizes).toEqual([]);
  });

  it("置き換えは、ファイルに無い景品を消し、ファイルの行の順が並び順になり、使われなくなった素材は索引から消える", async () => {
    await repo.addPrizes([prize("keep", { order: 1, image: "keep.png" }), prize("drop", { order: 2, image: "drop.png" }), prize("x", { order: 3 })], new Map([["keep.png", file("keep.png", "K")], ["drop.png", file("drop.png", "D")]]));
    const preview = await previewPrizeImport({ table: csvFile("ID,名前\nx,景品x\nkeep,景品keep\n"), media: [], mode: "replace" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { unchanged: 2, delete: 1 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    const record = await repo.readRecord();
    expect(record.prizes.map((p) => [p.id, p.order])).toEqual([["x", 1], ["keep", 2]]);
    expect(Object.keys(record.media)).toEqual(["keep.png"]);
  });

  it("同じ名前で中身が違う素材は差し替えになり、それを使う行は更新になる(共有の素材はほかの行にも及ぶ)", async () => {
    await seedShared();
    const csv = new TextDecoder().decode((await exportPrizes(repo, { includeMedia: false })).bytes);
    const preview = await previewPrizeImport({ table: csvFile(csv), media: [file("shared.png", "CHANGED!")], mode: "upsert" }, { repo });
    expect(preview).toMatchObject({ ok: true, counts: { update: 10, unchanged: 0 }, media: { added: 0, replaced: 1 } });
    if (!preview.ok) return;
    await preview.apply(() => undefined);
    expect((await repo.readRecord()).media["shared.png"].size).toBe(8);
  });

  it("取込を確定すると afterImport が呼ばれる。書き出しは保存の関数に渡される", async () => {
    const afterImport = vi.fn(async () => undefined);
    const save = vi.fn();
    const io = prizeTableIo({ repo, afterImport, save });
    const preview = await io.onPreviewImport({ table: csvFile("ID,名前\n,T\n"), media: [], mode: "upsert" });
    if (!preview.ok) throw new Error("preview");
    await preview.apply(() => undefined);
    expect(afterImport).toHaveBeenCalledOnce();
    await io.onExport({ includeMedia: false });
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ filename: "prizes.csv" }));
  });

  it("CSV でも ZIP でもないファイルは、プレビューの段階でエラーを返す", async () => {
    expect(await previewPrizeImport({ table: new File(["not a zip"], "x.zip"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
    expect(await previewPrizeImport({ table: csvFile("ID,メモ\n1,a\n"), media: [], mode: "upsert" }, { repo })).toMatchObject({ ok: false });
  });
});
