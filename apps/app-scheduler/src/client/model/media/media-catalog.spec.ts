import { describe, expect, it } from "vitest";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import type { AssetRecordEntry } from "../../../server/scheduler-api-contract";
import { MEDIA_SLICE_BUDGET_BYTES, diffPending, fromEntries, listFolders, mergeCatalog, readMediaSlice, toCatalog } from "./media-catalog";
import type { CatalogItem, HostMediaSlice } from "./media-catalog";

const ROOT = "octopus-scheduler/assets";
const meta = (id: string, fileName: string | undefined, parent = ROOT): DriveMetadata => ({
  driveDataId: id,
  fileId: `${parent}/${id}_${fileName ?? ""}`,
  parentFolderId: parent,
  lastUpdate: "",
  fileName,
});

describe("toCatalog", () => {
  it("表示名・種類・フォルダを付け、名前順に並べる", () => {
    const items = toCatalog([
      meta("2", "b.mp3"),
      meta("1", "a.PNG"),
      meta("3", "clip.mp4"),
      meta("4", "memo.txt"),
      meta("5", "s1.jpg", `${ROOT}/show1`),
    ]);
    expect(items.map((i) => [i.id, i.name, i.kind, i.folder])).toEqual([
      ["1", "a.PNG", "image", ""],
      ["2", "b.mp3", "audio", ""],
      ["3", "clip.mp4", "video", ""],
      ["4", "memo.txt", "file", ""],
      ["5", "s1.jpg", "image", "show1"],
    ]);
  });

  it("表示名が無い素材は id で表示し、種類は file", () => {
    expect(toCatalog([meta("x9", undefined), meta("x8", "  ")])).toEqual([
      { id: "x8", name: "x8", kind: "file", folder: "" },
      { id: "x9", name: "x9", kind: "file", folder: "" },
    ]);
  });

  it("置き場の外や、深い階層は最初の1階層をフォルダとする", () => {
    const [a, b] = toCatalog([meta("1", "a.png", "elsewhere/x"), meta("2", "b.png", `${ROOT}/f/g`)]);
    expect(a.folder).toBe("");
    expect(b.folder).toBe("f");
  });

  it("id の無いものは捨てる", () => {
    expect(toCatalog([{ ...meta("", "a.png") }])).toEqual([]);
  });
});

describe("listFolders", () => {
  it("画像が入っているフォルダだけを、重複なく名前順に返す", () => {
    const items = toCatalog([
      meta("1", "a.png", `${ROOT}/zeta`),
      meta("2", "b.png", `${ROOT}/zeta`),
      meta("3", "c.jpg", `${ROOT}/alpha`),
      meta("4", "d.mp3", `${ROOT}/music`),
      meta("5", "e.png"),
    ]);
    expect(listFolders(items)).toEqual(["alpha", "zeta"]);
  });
});

const item = (id: string, name = `${id}.png`, kind: CatalogItem["kind"] = "image", folder = ""): CatalogItem => ({ id, name, kind, folder });
const entry = (id: string, name: string, directoryId?: string): AssetRecordEntry => ({
  id, name, mime: "", hash: "h".repeat(32), size: 1, uploadedAt: "", lastUpdated: "", ...(directoryId ? { directoryId } : {}),
});
const sliceOf = (over: Partial<HostMediaSlice> = {}): HostMediaSlice => ({ rev: 1, pending: [], removedIds: [], truncated: 0, ...over });
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

describe("fromEntries", () => {
  it("ホストの一覧から、サーバーの一覧(toCatalog)と同じ決め方で項目を作る", () => {
    const local = fromEntries([entry("2", "b.mp3"), entry("1", "a.png", `${ROOT}/show1`)]);
    expect(local).toEqual([
      { id: "1", name: "a.png", kind: "image", folder: "show1" },
      { id: "2", name: "b.mp3", kind: "audio", folder: "" },
    ]);
    expect(fromEntries([entry("1", "a.png", `${ROOT}/show1`)])).toEqual(toCatalog([meta("1", "a.png", `${ROOT}/show1`)]));
  });
});

describe("diffPending", () => {
  it("ホストにだけある素材が pending、サーバーにだけ残っている素材が removedIds(同じ id は差にしない)", () => {
    const diff = diffPending([item("a"), item("b"), item("c")], [item("b"), item("d")], MEDIA_SLICE_BUDGET_BYTES, new Set(["b", "d"]));
    expect(diff).toEqual({ pending: [item("a"), item("c")], removedIds: ["d"], truncated: 0 });
  });

  it("サーバーにあってホストに無い素材でも、最後の同期で揃っていなかったもの(他の端末が足して、ホストがまだ取り込んでいない)は removedIds にしない", () => {
    const diff = diffPending([item("a")], [item("a"), item("added-elsewhere"), item("deleted-on-host")], MEDIA_SLICE_BUDGET_BYTES, new Set(["a", "deleted-on-host"]));
    expect(diff.removedIds).toEqual(["deleted-on-host"]);
    expect(diffPending([], [item("x")], MEDIA_SLICE_BUDGET_BYTES, new Set()).removedIds).toEqual([]); // 入室直後(同期の前)は、何も消したことにしない
  });

  it("差が無ければ空", () => {
    expect(diffPending([item("a")], [item("a")], MEDIA_SLICE_BUDGET_BYTES, new Set(["a"]))).toEqual({ pending: [], removedIds: [], truncated: 0 });
  });

  it("予算に収まるだけを名前順に載せ、載せきれない分は truncated に数える(rev などを足しても予算を超えない)", () => {
    const local = Array.from({ length: 60 }, (_, i) => item(`id-${String(i).padStart(3, "0")}-${"x".repeat(30)}`, `素材-${String(i).padStart(3, "0")}.png`));
    const diff = diffPending(local, [], MEDIA_SLICE_BUDGET_BYTES, new Set());
    expect(diff.pending.length).toBeGreaterThan(0);
    expect(diff.pending.length).toBeLessThan(60);
    expect(diff.truncated).toBe(60 - diff.pending.length);
    expect(diff.pending.map((i) => i.name)).toEqual(local.slice(0, diff.pending.length).map((i) => i.name));
    const worst = { rev: 9_999_999_999_999, ...diff, lastError: { assetId: "e".repeat(64), at: 9_999_999_999_999 } };
    expect(bytes(worst)).toBeLessThanOrEqual(MEDIA_SLICE_BUDGET_BYTES);
  });

  it("ホストにだけある素材を先に載せ、残りの予算で removedIds を載せる(両方の取りこぼしを数える)", () => {
    const removed = Array.from({ length: 200 }, (_, i) => item(`gone-${String(i).padStart(3, "0")}-${"y".repeat(30)}`));
    const diff = diffPending([item("new")], removed, MEDIA_SLICE_BUDGET_BYTES, new Set(removed.map((i) => i.id)));
    expect(diff.pending).toEqual([item("new")]);
    expect(diff.removedIds.length).toBeGreaterThan(0);
    expect(diff.removedIds.length).toBeLessThan(200);
    expect(diff.truncated).toBe(200 - diff.removedIds.length);
  });

  it("予算が小さすぎて1件も載らなければ、すべて truncated", () => {
    expect(diffPending([item("a"), item("b")], [item("z")], 50, new Set(["z"]))).toEqual({ pending: [], removedIds: [], truncated: 3 });
  });
});

describe("mergeCatalog", () => {
  it("スライスが無ければ、サーバーの一覧のまま", () => {
    expect(mergeCatalog([item("a")], null)).toEqual([item("a")]);
  });

  it("ホストが消した素材を除き、アップロード前の素材を足す。名前順", () => {
    const merged = mergeCatalog([item("a", "m.png"), item("b", "z.png")], sliceOf({ pending: [item("p", "a.png")], removedIds: ["b"] }));
    expect(merged.map((i) => i.id)).toEqual(["p", "a"]);
  });

  it("アップロードが済んでサーバーの一覧にも載った素材は、重ならず1件", () => {
    const merged = mergeCatalog([item("a"), item("p")], sliceOf({ pending: [item("p")] }));
    expect(merged.map((i) => i.id)).toEqual(["a", "p"]);
  });

  it("ホストが替わった(新しいホストのスライスは pending が空)ら、前のホストの未アップロード分は消え、サーバーにある分だけが残る", () => {
    const remote = [item("up")];
    const oldHost = sliceOf({ rev: 5, pending: [item("only-on-old-host")] });
    const newHost = sliceOf({ rev: 99, pending: [] });
    expect(mergeCatalog(remote, oldHost).map((i) => i.id)).toEqual(["only-on-old-host", "up"]);
    expect(mergeCatalog(remote, newHost).map((i) => i.id)).toEqual(["up"]);
  });
});

describe("readMediaSlice", () => {
  it("ルーム状態の media を読む。形の違う項目は捨てる", () => {
    const data = { media: { rev: 3, pending: [item("a"), { id: 1 }], removedIds: ["x", 2], truncated: 4, lastError: { assetId: "a", at: 7 } } };
    expect(readMediaSlice(data)).toEqual({ rev: 3, pending: [item("a")], removedIds: ["x"], truncated: 4, lastError: { assetId: "a", at: 7 } });
  });

  it("無い・形が違うなら null(古いホスト・まだ公開していない)", () => {
    expect(readMediaSlice(undefined)).toBeNull();
    expect(readMediaSlice({})).toBeNull();
    expect(readMediaSlice({ media: { rev: "1" } })).toBeNull();
  });
});
