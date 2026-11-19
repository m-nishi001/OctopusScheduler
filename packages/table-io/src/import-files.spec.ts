import { describe, expect, it } from "vitest";
import { parseTable } from "./csv";
import { explainOversized, readImportFiles, referencedMedia } from "./import-files";
import { buildZip } from "./zip";

// jsdom の Blob / File には arrayBuffer が無いことがあるので、FileReader で補う。
Blob.prototype.arrayBuffer ??= function (this: Blob) {
  return new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(this);
  });
};

describe("readImportFiles", () => {
  it("CSV とフォルダの素材を読む。種類が分からないファイルには拡張子から種類を付ける", async () => {
    const r = await readImportFiles(new File(["ID\n1\n"], "a.csv"), [new File(["x"], "pic.png")]);
    if (!r.ok) throw new Error("read");
    expect(new TextDecoder().decode(r.value.csv)).toBe("ID\n1\n");
    expect(r.value.files.get("pic.png")!.type).toBe("image/png");
  });

  it("ZIP は CSV と素材を取り出し、フォルダで選んだ同名の素材を優先する", async () => {
    const zip = buildZip("t.csv", "ID\n1\n", [["a.png", new Uint8Array([1])], ["b.png", new Uint8Array([2])]]);
    const folder = new File(["override"], "a.png", { type: "image/png" });
    const r = await readImportFiles(new File([zip as BlobPart], "t.zip"), [folder]);
    if (!r.ok) throw new Error("read");
    expect([...r.value.files.keys()].sort()).toEqual(["a.png", "b.png"]);
    expect(r.value.files.get("a.png")).toBe(folder);
  });

  it("壊れた ZIP と、CSV の無い ZIP はエラー文を返す", async () => {
    expect(await readImportFiles(new File(["nope"], "x.zip"), [])).toEqual({ ok: false, errors: ["ZIP を開けません"] });
    const noCsv = buildZip("x.txt", "", []);
    expect(await readImportFiles(new File([noCsv as BlobPart], "x.zip"), [])).toMatchObject({ ok: false });
  });
});

describe("referencedMedia", () => {
  it("CSV の素材の列が指していて、選ばれたファイルにもある素材だけを、重複なしで返す(`-` と空は除く)", () => {
    const parsed = parseTable(
      new TextEncoder().encode("ID,画像,BGM\n1,sub/a.png,-\n2,a.png,missing.mp3\n3,,b.mp3\n"),
      [{ key: "id", label: "ID" }, { key: "image", label: "画像", media: true }, { key: "bgm", label: "BGM", media: true }]
    );
    if (!parsed.ok) throw new Error("parse");
    expect(referencedMedia(parsed, new Map([["a.png", 1], ["b.mp3", 2], ["unused.png", 3]])).sort()).toEqual(["a.png", "b.mp3"]);
  });
});

describe("上限を超える素材", () => {
  it("上限を超える素材は、取り込める素材(files)に入れず、oversized に名前とバイト数で返す(ZIP の中も、フォルダで選んだものも)", async () => {
    const zip = buildZip("t.csv", "ID\n1\n", [["small.png", new Uint8Array(3)], ["big.mp3", new Uint8Array(11)]]);
    const folderBig = new File([new Uint8Array(12)], "big2.mp3", { type: "audio/mpeg" });
    const r = await readImportFiles(new File([zip as BlobPart], "t.zip"), [folderBig], 10);
    if (!r.ok) throw new Error("read");
    expect([...r.value.files.keys()]).toEqual(["small.png"]);
    expect([...r.value.oversized]).toEqual([["big.mp3", 11], ["big2.mp3", 12]]);
  });

  it("上限を渡さなければ、すべて取り込める素材", async () => {
    const r = await readImportFiles(new File(["ID\n1\n"], "a.csv"), [new File([new Uint8Array(50)], "x.mp3")]);
    if (!r.ok) throw new Error("read");
    expect(r.value.oversized.size).toBe(0);
    expect(r.value.files.has("x.mp3")).toBe(true);
  });

  it("explainOversized: 大きすぎる素材を指す行のエラーだけを、ファイル名と上限のある文にする", () => {
    const mb = 1024 * 1024;
    const rows = [
      { status: "error", message: "ファイル「big.mp3」が見つかりません(CSV と一緒に…)" },
      { status: "error", message: "抽選画像「other.png」が見つかりません" },
      { status: "add" },
    ];
    const out = explainOversized(rows, new Map([["big.mp3", 45.6 * mb]]), 30 * mb);
    expect(out[0].message).toBe("素材「big.mp3」が上限(30.0MB)を超えています(45.6MB)。圧縮するか分けてください");
    expect(out[1]).toBe(rows[1]);
    expect(out[2]).toBe(rows[2]);
    expect(explainOversized(rows, new Map(), mb)).toEqual(rows);
  });
});
