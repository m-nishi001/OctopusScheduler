import { describe, expect, it } from "vitest";
import { deriveMedia, diffMedia, resolveMediaCell } from "./media";

describe("deriveMedia", () => {
  const known = new Map([["a.png", "h1"], ["b.mp3", "h2"], ["old.png", "h0"]]);
  const refs = (e: { files: string[] }) => e.files;

  it("参照されている名前だけの索引を作り、同じ名前は1つにまとまる", () => {
    expect(deriveMedia([{ files: ["a.png", "b.mp3"] }, { files: ["a.png", ""] }], refs, known)).toEqual({ "a.png": "h1", "b.mp3": "h2" });
  });

  it("使われなくなった素材(old.png)は索引から消える", () => {
    expect(deriveMedia([{ files: ["a.png"] }], refs, known)).toEqual({ "a.png": "h1" });
  });

  it("索引の値はハッシュに限らない(素材の情報をそのまま持てる)", () => {
    const info = new Map([["a.png", { hash: "h1", mime: "image/png", size: 3 }]]);
    expect(deriveMedia([{ files: ["a.png"] }], refs, info)).toEqual({ "a.png": { hash: "h1", mime: "image/png", size: 3 } });
  });

  it("known に無い名前を参照していれば例外(参照切れのまま保存しない)", () => {
    expect(() => deriveMedia([{ files: ["zzz.png"] }], refs, known)).toThrow("zzz.png");
  });
});

describe("diffMedia", () => {
  it("新規 / 差し替え / 同じ を分ける", () => {
    expect(diffMedia({ "a.png": "h1", "b.png": "h2" }, new Map([["a.png", "h1"], ["b.png", "hX"], ["c.png", "h3"]]))).toEqual({
      added: ["c.png"],
      replaced: ["b.png"],
      same: ["a.png"],
    });
  });
});

describe("resolveMediaCell", () => {
  const available = new Set(["a.png"]);

  it("空 = いまのまま、`-` = 外す、それ以外 = ファイル名(フォルダ部分は無視)", () => {
    expect(resolveMediaCell("", "old.png", available)).toEqual({ name: "old.png" });
    expect(resolveMediaCell(undefined, undefined, available)).toEqual({ name: null });
    expect(resolveMediaCell("-", "old.png", available)).toEqual({ name: null });
    expect(resolveMediaCell(" images\\a.png ", null, available)).toEqual({ name: "a.png" });
    expect(resolveMediaCell("sub/a.png", null, available)).toEqual({ name: "a.png" });
  });

  it("使える素材の中に無い名前は missing を返す。使える素材を渡さなければ検査しない", () => {
    expect(resolveMediaCell("zzz.png", null, available)).toEqual({ missing: "zzz.png" });
    expect(resolveMediaCell("zzz.png", null)).toEqual({ name: "zzz.png" });
  });
});
