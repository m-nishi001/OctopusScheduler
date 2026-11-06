import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { hashBlob } from "@octopus/sync-engine";
import { readZip } from "@octopus/table-io";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";
import type { ImportedAsset } from "@model/asset/asset-repository";
import type { AppEvent } from "../app-event/app-event";
import { exportEvents, previewEventImport } from "./event-table-io";
import type { EventTableAssets, EventTableEvents } from "./event-table-io";

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

const file = (name: string, text: string, type: string) => new File([text], name, { type });
const csvFile = (text: string) => new File([text], "events.csv", { type: "text/csv" });
const HEADER = "ID,種別,開始,終了,素材,表示,フォルダ,切替秒,切替効果,フェードアウト秒,遷移先URL\r\n";
const T = "2026-11-02 09:00,2026-11-02 10:00";
const timing = { processedAt: null, registeredAt: new Date(2026, 5, 5), updatedAt: new Date(2026, 5, 5) };

/** メモリ上の素材の一覧と中身、イベント。書き込みの回数を数える。 */
async function setup(initialAssets: [name: string, text: string, type: string, id?: string][], initialEvents: AppEvent[] = []) {
  const blobs = new Map<string, Blob>();
  let entries: AssetRecordEntry[] = [];
  for (const [name, text, type, id = `id-${name}`] of initialAssets) {
    const blob = new Blob([text], { type });
    const hash = await hashBlob(blob);
    blobs.set(hash, blob);
    entries.push({ id, name, mime: type, hash, size: blob.size, uploadedAt: "t", lastUpdated: "t" });
  }
  let events = [...initialEvents];
  const assets: EventTableAssets = {
    readEntries: async () => entries,
    blobOf: async (hash) => blobs.get(hash) ?? null,
    applyImport: vi.fn(async (files: readonly ImportedAsset[]) => {
      for (const f of files) {
        blobs.set(f.hash, f.blob);
        const entry = { id: f.id, name: f.name, mime: f.blob.type, hash: f.hash, size: f.blob.size, uploadedAt: "t", lastUpdated: "t" };
        entries = entries.some((e) => e.id === f.id) ? entries.map((e) => (e.id === f.id ? { ...e, ...entry, name: e.name } : e)) : [...entries, entry];
      }
    }),
  };
  const eventsPort: EventTableEvents = {
    getScheduleEvents: async () => events,
    applyImport: vi.fn(async (upserts: readonly AppEvent[], deleteIds: readonly string[]) => {
      const gone = new Set(deleteIds);
      const replaced = new Map(upserts.map((e) => [e.id, e] as const));
      events = [...events.filter((e) => !gone.has(e.id)).map((e) => replaced.get(e.id) ?? e), ...upserts.filter((e) => !events.some((x) => x.id === e.id))];
    }),
  };
  return { assets, events: eventsPort, entries: () => entries, current: () => events };
}

const audio = (id: string, audioId: string): AppEvent => ({ id, type: "AudioEvent", startTime: new Date(2026, 10, 2, 9), endTime: new Date(2026, 10, 2, 10), audioId, fadeOutSec: 0, ...timing });
const image = (id: string, assetId: string): AppEvent => ({ id, type: "ScreenEvent", startTime: new Date(2026, 10, 2, 9), endTime: new Date(2026, 10, 2, 10), spec: { kind: "image", id: assetId }, ...timing });

describe("イベントの書き出し", () => {
  let env: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => {
    env = await setup(
      [["bgm.wav", "WAV", "audio/wav"], ["pic.png", "PNG", "image/png"], ["unused.png", "U", "image/png"]],
      [audio("e1", "id-bgm.wav"), audio("e2", "id-bgm.wav"), image("e3", "id-pic.png")]
    );
  });

  it("CSV は素材をファイル名で書く。ZIP には、使われている素材を1つずつ media/<名前> に入れる(使われない素材は入れない)", async () => {
    const csv = await exportEvents(env, { includeMedia: false });
    expect(csv.filename).toBe("events.csv");
    expect(new TextDecoder().decode(csv.bytes)).toContain("e1,音楽,");
    const zip = await exportEvents(env, { includeMedia: true });
    expect(zip.filename).toBe("events.zip");
    expect(zip.missingMedia).toBe(0);
    expect([...readZip(zip.bytes).media.keys()].sort()).toEqual(["bgm.wav", "pic.png"]);
  });

  it("書き出した ZIP / CSV をそのまま取り込むと全行が変更なしで、素材の差もない(置き換えでも)", async () => {
    for (const includeMedia of [true, false]) {
      const out = await exportEvents(env, { includeMedia });
      const table = new File([out.bytes as BlobPart], out.filename);
      const p = await previewEventImport({ table, media: [], mode: "replace" }, env);
      expect(p).toMatchObject({ ok: true, counts: { unchanged: 3, add: 0, update: 0, delete: 0, error: 0 }, media: { added: 0, replaced: 0 } });
    }
  });
});

describe("イベントの取込: 素材の引き当て", () => {
  it("一覧にある名前は参照するだけ(素材は書かない)。取り込むのはイベントの1回の書き込み", async () => {
    const env = await setup([["bgm.wav", "WAV", "audio/wav"]]);
    const p = await previewEventImport({ table: csvFile(`${HEADER}n1,音楽,${T},bgm.wav,,,,,,\r\n`), media: [], mode: "upsert" }, env);
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.counts.add).toBe(1);
    await p.apply(() => undefined);
    expect(env.events.applyImport).toHaveBeenCalledTimes(1);
    expect(env.current()[0]).toMatchObject({ type: "AudioEvent", audioId: "id-bgm.wav" });
    expect(env.entries()).toHaveLength(1);
  });

  it("同じ名前で中身が違うファイルがあれば、同じ id の素材を差し替え、それを使う行が更新になる", async () => {
    const env = await setup([["bgm.wav", "OLD", "audio/wav"]], [audio("e1", "id-bgm.wav")]);
    const before = env.entries()[0].hash;
    const p = await previewEventImport({ table: csvFile(`${HEADER}e1,音楽,2026-11-02 09:00,2026-11-02 10:00,bgm.wav,,,,,0,\r\n`), media: [file("bgm.wav", "NEW", "audio/wav")], mode: "upsert" }, env);
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.counts).toMatchObject({ update: 1, unchanged: 0 });
    expect(p.media).toEqual({ added: 0, replaced: 1 });
    await p.apply(() => undefined);
    expect(env.assets.applyImport).toHaveBeenCalledTimes(1);
    expect(env.entries()).toHaveLength(1);
    expect(env.entries()[0]).toMatchObject({ id: "id-bgm.wav", name: "bgm.wav" });
    expect(env.entries()[0].hash).not.toBe(before);
    expect(env.current()[0]).toMatchObject({ id: "e1", audioId: "id-bgm.wav" });
  });

  it("同じ中身のファイルなら差し替えにならない(変更なし)", async () => {
    const env = await setup([["bgm.wav", "SAME", "audio/wav"]], [audio("e1", "id-bgm.wav")]);
    const out = await exportEvents(env, { includeMedia: false });
    const p = await previewEventImport({ table: new File([out.bytes as BlobPart], "events.csv"), media: [file("bgm.wav", "SAME", "audio/wav")], mode: "upsert" }, env);
    expect(p).toMatchObject({ ok: true, counts: { unchanged: 1, update: 0 }, media: { added: 0, replaced: 0 } });
  });

  it("一覧に無い名前でファイルがあれば、新しい素材として追加し、イベントがそれを参照する(アセットの書き込みは1回)", async () => {
    const env = await setup([]);
    const csv = `${HEADER}n1,スクリーン,${T},new.png,画像,,,,,\r\nn2,スクリーン,${T},new.png,画像,,,,,\r\n`;
    const p = await previewEventImport({ table: csvFile(csv), media: [file("new.png", "IMG", "image/png")], mode: "upsert" }, env);
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.media).toEqual({ added: 1, replaced: 0 });
    await p.apply(() => undefined);
    expect(env.assets.applyImport).toHaveBeenCalledTimes(1);
    expect(env.events.applyImport).toHaveBeenCalledTimes(1);
    expect(env.entries()).toHaveLength(1);
    const id = env.entries()[0].id;
    expect(env.current().map((e) => (e.type === "ScreenEvent" && e.spec.kind === "image" ? e.spec.id : null))).toEqual([id, id]);
  });

  it("一覧にもファイルにも無い名前は行のエラーで、何も書かない", async () => {
    const env = await setup([["bgm.wav", "WAV", "audio/wav"]]);
    const p = await previewEventImport({ table: csvFile(`${HEADER}n1,音楽,${T},none.wav,,,,,,\r\nn2,音楽,${T},bgm.wav,,,,,,\r\n`), media: [], mode: "upsert" }, env);
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.counts).toMatchObject({ error: 1, add: 1 });
    expect(p.rows[0].message).toContain("「none.wav」が見つかりません");
    await expect(p.apply(() => undefined)).rejects.toThrow("エラーの行");
    expect(env.events.applyImport).not.toHaveBeenCalled();
    expect(env.assets.applyImport).not.toHaveBeenCalled();
  });

  it("同じ名前の素材が一覧に複数あると行のエラー(ファイルを渡しても触らない)", async () => {
    const env = await setup([["bgm.wav", "A", "audio/wav", "a1"], ["bgm.wav", "B", "audio/wav", "a2"]]);
    const p = await previewEventImport({ table: csvFile(`${HEADER}n1,音楽,${T},bgm.wav,,,,,,\r\n`), media: [file("bgm.wav", "C", "audio/wav")], mode: "upsert" }, env);
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.rows[0]).toMatchObject({ status: "error", message: "同名の素材が複数あります: bgm.wav" });
    expect(p.media).toEqual({ added: 0, replaced: 0 });
  });

  it("使われない行のファイル(例: 音楽の行にあるだけの別の素材)は、素材として入れない", async () => {
    const env = await setup([["bgm.wav", "WAV", "audio/wav"]]);
    const csv = `${HEADER}n1,ページ遷移,${T},extra.png,,,,,,/x\r\n`;
    const p = await previewEventImport({ table: csvFile(csv), media: [file("extra.png", "X", "image/png")], mode: "upsert" }, env);
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.media).toEqual({ added: 0, replaced: 0 });
    await p.apply(() => undefined);
    expect(env.entries()).toHaveLength(1);
  });
});

describe("イベントの取込: 置き換え", () => {
  it("ファイルに無いイベントを削除するが、設定>アセットの素材は1つも消さない(使われなくなっても残る)", async () => {
    const env = await setup([["bgm.wav", "WAV", "audio/wav"], ["pic.png", "PNG", "image/png"]], [audio("e1", "id-bgm.wav"), image("e2", "id-pic.png"), image("e3", "id-pic.png")]);
    const p = await previewEventImport(
      { table: csvFile(`${HEADER}e1,音楽,2026-11-02 09:00,2026-11-02 10:00,bgm.wav,,,,,0,\r\n`), media: [], mode: "replace" },
      env
    );
    if (!p.ok) throw new Error(JSON.stringify(p));
    expect(p.counts).toMatchObject({ unchanged: 1, delete: 2 });
    const result = await p.apply(() => undefined);
    expect(result.summary).toBe("追加 0 / 更新 0 / 変更なし 1 / 削除 2");
    expect(env.current().map((e) => e.id)).toEqual(["e1"]);
    expect(env.events.applyImport).toHaveBeenCalledWith([], ["e2", "e3"]);
    expect(env.entries().map((e) => e.name)).toEqual(["bgm.wav", "pic.png"]);
  });
});
