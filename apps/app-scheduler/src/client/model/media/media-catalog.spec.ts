import { describe, expect, it } from "vitest";
import type { DriveMetadata } from "@octopus/infrastructures/compositions";
import { listFolders, toCatalog } from "./media-catalog";

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
