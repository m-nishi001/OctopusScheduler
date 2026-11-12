import "reflect-metadata";
import { describe, expect, it, vi } from "vitest";
import { hashBlob } from "@octopus/sync-engine";
import { readZip } from "@octopus/table-io";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";
import type { ImportedAsset } from "@model/asset/asset-repository";
import type { AppEvent } from "../app-event/app-event";
import { exportAssets, previewAssetImport } from "./asset-table-io";
import type { AssetTableAssets, AssetTableEvents } from "./asset-table-io";
import { directoryOf } from "./asset-table";

// この環境の jsdom には crypto.subtle も Blob.arrayBuffer も無いので、中身から決まる値を返す簡易なものに差し替える。
let uuid = 0;
vi.stubGlobal("crypto", {
  subtle: {
    digest: async (_a: string, data: ArrayBuffer) => {
      const out = new Uint8Array(32);
      let h = 2166136261;
      new Uint8Array(data).forEach((b, i) => {
        h = Math.imul(h ^ b, 16777619) >>> 0;
        out[i % 32] ^= h & 255;
      });
      for (let i = 0; i < 32; i++) {
        h = Math.imul(h ^ out[i] ^ i, 16777619) >>> 0;
        out[i] = h & 255;
      }
      return out.buffer;
    },
  },
  randomUUID: () => `uuid-${++uuid}`,
});
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(this);
  });
};

const DIR = (folder: string) => directoryOf(folder);
const file = (name: string, text: string, type: string) => new File([text], name, { type });
const csvFile = (text: string) => new File([text], "assets.csv", { type: "text/csv" });
const HEADER = "名前,フォルダ\r\n";
const timing = { processedAt: null, registeredAt: new Date(2026, 5, 5), updatedAt: new Date(2026, 5, 5) };

type Seed = [name: string, text: string, type: string, folder?: string, id?: string];

/** メモリ上の素材の一覧と中身、イベント。 */
async function setup(seed: Seed[], events: AppEvent[] = []) {
  const blobs = new Map<string, Blob>();
  let entries: AssetRecordEntry[] = [];
  for (const [name, text, type, folder = "", id = `id-${name}`] of seed) {
    const blob = new Blob([text], { type });
    const hash = await hashBlob(blob);
    blobs.set(hash, blob);
    entries.push({ id, name, mime: type, hash, size: blob.size, uploadedAt: "t", lastUpdated: "t", directoryId: DIR(folder) });
  }
  const assets: AssetTableAssets = {
    readEntries: async () => entries,
    blobOf: async (hash) => blobs.get(hash) ?? null,
    applyImport: vi.fn(async (files: readonly ImportedAsset[], directories: ReadonlyMap<string, string | undefined> = new Map()) => {
      for (const f of files) {
        blobs.set(f.hash, f.blob);
        const entry: AssetRecordEntry = { id: f.id, name: f.name, mime: f.blob.type, hash: f.hash, size: f.blob.size, uploadedAt: "t", lastUpdated: "t" };
        entries = entries.some((e) => e.id === f.id) ? entries.map((e) => (e.id === f.id ? { ...e, ...entry, name: e.name, directoryId: e.directoryId } : e)) : [...entries, entry];
      }
      entries = entries.map((e) => (directories.has(e.id) ? { ...e, directoryId: directories.get(e.id) } : e));
    }),
    deleteAssets: vi.fn(async (ids: string[]) => {
      entries = entries.filter((e) => !ids.includes(e.id));
    }),
  };
  const eventsPort: AssetTableEvents = { getScheduleEvents: async () => events };
  return { assets, events: eventsPort, entries: () => entries };
}

const audio = (id: string, audioId: string): AppEvent => ({ id, type: "AudioEvent", startTime: new Date(2026, 10, 2, 9), endTime: new Date(2026, 10, 2, 10), audioId, fadeOutSec: 0, ...timing });
const preview = async (env: Awaited<ReturnType<typeof setup>>, csv: string, media: File[], mode: "upsert" | "replace" = "upsert") => {
  const p = await previewAssetImport({ table: csvFile(csv), media, mode }, env);
  if (!p.ok) throw new Error(JSON.stringify(p));
  return p;
};

describe("素材の書き出し", () => {
  it("CSV は 名前,フォルダ。ZIP には全素材を media/<名前> に入れる。書き出したものをそのまま取り込むと全行変更なし(置き換えでも)", async () => {
    const env = await setup([["bgm.wav", "WAV", "audio/wav", "BGM"], ["pic.png", "PNG", "image/png"]]);
    const csv = await exportAssets(env, { includeMedia: false });
    expect(csv.filename).toBe("assets.csv");
    expect(new TextDecoder("utf-8", { ignoreBOM: true }).decode(csv.bytes)).toBe("\uFEFF名前,フォルダ\r\nbgm.wav,BGM\r\npic.png,\r\n");
    const zip = await exportAssets(env, { includeMedia: true });
    expect(zip.filename).toBe("assets.zip");
    expect([...readZip(zip.bytes).media.keys()].sort()).toEqual(["bgm.wav", "pic.png"]);
    for (const out of [csv, zip]) {
      const q = await previewAssetImport({ table: new File([out.bytes as BlobPart], out.filename), media: [], mode: "replace" }, env);
      expect(q).toMatchObject({ ok: true, counts: { unchanged: 2, add: 0, update: 0, delete: 0, error: 0 } });
    }
  });

  it("同じ名前の素材が複数あると書き出せない", async () => {
    const env = await setup([["a.png", "A", "image/png", "", "x1"], ["a.png", "B", "image/png", "", "x2"]]);
    await expect(exportAssets(env, { includeMedia: false })).rejects.toThrow("同じ名前の素材があるため書き出せません: a.png");
  });
});

describe("素材の取込", () => {
  it("新しい素材はファイルが必須。ファイルがあれば追加し、フォルダも付く(書き込みは1回)", async () => {
    const env = await setup([]);
    const p = await preview(env, `${HEADER}new.png,Shot\r\nroot.mp3,\r\n`, [file("new.png", "IMG", "image/png"), file("root.mp3", "MP3", "audio/mpeg")]);
    expect(p.counts).toMatchObject({ add: 2, error: 0 });
    await p.apply(() => undefined);
    expect(env.assets.applyImport).toHaveBeenCalledTimes(1);
    expect(env.entries().map((e) => [e.name, e.directoryId])).toEqual([["new.png", DIR("Shot")], ["root.mp3", undefined]]);
  });

  it("ファイルが無い新しい名前、画像・音声・動画でないファイル、2階層のフォルダ、名前のパスは行のエラーで、何も書かない", async () => {
    const env = await setup([]);
    const p = await preview(env, `${HEADER}none.png,\r\ndoc.txt,\r\nok.png,A/B\r\nx/ok.png,\r\n`, [file("doc.txt", "T", "text/plain"), file("ok.png", "O", "image/png")]);
    expect(p.counts.error).toBe(4);
    expect(p.rows[0].message).toContain("「none.png」が見つかりません");
    expect(p.rows[1].message).toContain("画像・音声・動画");
    expect(p.rows[2].message).toContain("1階層");
    expect(p.rows[3].message).toContain("フォルダは含められません");
    await expect(p.apply(() => undefined)).rejects.toThrow("エラーの行");
    expect(env.assets.applyImport).not.toHaveBeenCalled();
  });

  it("既存の素材: ファイルが無ければフォルダだけを変える(中身はそのまま)。同じ中身のファイルがあれば変更なし", async () => {
    const env = await setup([["a.png", "SAME", "image/png"], ["b.png", "B", "image/png", "Old"]]);
    const before = env.entries().map((e) => e.hash);
    const p = await preview(env, `${HEADER}a.png,New\r\nb.png,Old\r\n`, [file("b.png", "B", "image/png")]);
    expect(p.counts).toMatchObject({ update: 1, unchanged: 1 });
    await p.apply(() => undefined);
    expect(env.entries().map((e) => e.hash)).toEqual(before);
    expect(env.entries().map((e) => e.directoryId)).toEqual([DIR("New"), DIR("Old")]);
  });

  it("同じ名前で中身が違うファイルは、同じ id のまま差し替える(更新)", async () => {
    const env = await setup([["a.png", "OLD", "image/png"]]);
    const before = env.entries()[0].hash;
    const p = await preview(env, `${HEADER}a.png,\r\n`, [file("a.png", "NEW", "image/png")]);
    expect(p.counts.update).toBe(1);
    await p.apply(() => undefined);
    expect(env.entries()).toHaveLength(1);
    expect(env.entries()[0]).toMatchObject({ id: "id-a.png" });
    expect(env.entries()[0].hash).not.toBe(before);
  });

  it("同じ名前の素材が一覧に複数あると、その名前の行はエラー", async () => {
    const env = await setup([["a.png", "A", "image/png", "", "x1"], ["a.png", "B", "image/png", "", "x2"]]);
    const p = await preview(env, `${HEADER}a.png,\r\n`, []);
    expect(p.rows[0]).toMatchObject({ status: "error", message: "同名の素材が複数あります: a.png" });
  });

  it("置き換え: ファイルに無い素材を削除するが、イベントが使っている素材は残す", async () => {
    const env = await setup([["keep.png", "K", "image/png"], ["used.wav", "U", "audio/wav"], ["gone.png", "G", "image/png"]], [audio("e1", "id-used.wav")]);
    const p = await preview(env, `${HEADER}keep.png,\r\n`, [], "replace");
    expect(p.counts).toMatchObject({ unchanged: 1, delete: 1 });
    const result = await p.apply(() => undefined);
    expect(env.assets.deleteAssets).toHaveBeenCalledWith(["id-gone.png"]);
    expect(env.entries().map((e) => e.name)).toEqual(["keep.png", "used.wav"]);
    expect(result.details[0]).toContain("1 件");
  });
});
