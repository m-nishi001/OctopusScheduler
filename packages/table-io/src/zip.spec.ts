import { describe, expect, it } from "vitest";
import { zipSync } from "fflate";
import { buildZip, readZip } from "./zip";

const bytes = (...n: number[]) => new Uint8Array(n);

describe("zip", () => {
  it("CSV と素材を書いて読み戻せる", () => {
    const zip = buildZip("items.csv", "ID\r\n", new Map([["a.png", bytes(1, 2)], ["b.mp3", bytes(3)]]));
    const out = readZip(zip);
    expect(new TextDecoder().decode(out.csv!)).toBe("ID\r\n");
    expect([...out.media.keys()]).toEqual(["a.png", "b.mp3"]);
    expect([...out.media.get("a.png")!]).toEqual([1, 2]);
  });

  it("同じファイル名の素材は1回だけ入れる", () => {
    const zip = buildZip("items.csv", "", [["a.png", bytes(1)], ["a.png", bytes(1)], ["b.png", bytes(2)]]);
    expect(Object.keys(zip.length ? readZipNames(zip) : {})).toEqual(["items.csv", "media/a.png", "media/b.png"]);
  });

  it("__MACOSX とドットで始まるファイル、フォルダは無視する", () => {
    const zip = zipSync({
      "x.csv": bytes(65),
      "__MACOSX/._x.csv": bytes(1),
      "media/.DS_Store": bytes(1),
      "media/a.png": bytes(9),
    });
    const out = readZip(zip);
    expect(out.csv).not.toBeNull();
    expect([...out.media.keys()]).toEqual(["a.png"]);
  });

  it("CSV が無い ZIP は csv が null", () => {
    expect(readZip(zipSync({ "media/a.png": bytes(1) })).csv).toBeNull();
  });
});

import { unzipSync } from "fflate";
function readZipNames(zip: Uint8Array): Record<string, Uint8Array> {
  return unzipSync(zip);
}
