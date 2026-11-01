import { describe, expect, it } from "vitest";
import { deriveMedia, diffMedia } from "./media";

describe("deriveMedia", () => {
  const known = new Map([["a.png", "h1"], ["b.mp3", "h2"], ["old.png", "h0"]]);
  const refs = (e: { files: string[] }) => e.files;

  it("参照されている名前だけの索引を作り、同じ名前は1つにまとまる", () => {
    expect(deriveMedia([{ files: ["a.png", "b.mp3"] }, { files: ["a.png", ""] }], refs, known)).toEqual({ "a.png": "h1", "b.mp3": "h2" });
  });

  it("使われなくなった素材(old.png)は索引から消える", () => {
    expect(deriveMedia([{ files: ["a.png"] }], refs, known)).toEqual({ "a.png": "h1" });
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
