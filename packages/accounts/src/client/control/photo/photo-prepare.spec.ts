import { describe, expect, it } from "vitest";
import { bytesToDataUrl, fitWithin, hashPhotoBytes, preparePhoto } from "./photo-prepare";

describe("fitWithin", () => {
  it("長辺が上限以内なら、そのまま(拡大しない)", () => {
    expect(fitWithin(300, 200)).toEqual({ width: 300, height: 200 });
    expect(fitWithin(512, 512)).toEqual({ width: 512, height: 512 });
  });
  it("長辺が上限を超えるなら、縦横比を保って長辺を上限にする", () => {
    expect(fitWithin(4000, 3000)).toEqual({ width: 512, height: 384 });
    expect(fitWithin(3000, 4000)).toEqual({ width: 384, height: 512 });
    expect(fitWithin(10000, 10)).toEqual({ width: 512, height: 1 });
    expect(fitWithin(2000, 1000, 100)).toEqual({ width: 100, height: 50 });
  });
});

describe("hashPhotoBytes / bytesToDataUrl", () => {
  it("SHA-256 の先頭16桁(既知の値)", async () => {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    expect(await hashPhotoBytes(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea");
  });
  it("データURLにできる。大きなバイト列でも崩れない", () => {
    expect(bytesToDataUrl(new TextEncoder().encode("abc"), "image/webp")).toBe("data:image/webp;base64,YWJj");
    const big = new Uint8Array(100_000).fill(65);
    expect(atob(bytesToDataUrl(big, "image/jpeg").split(",")[1])).toHaveLength(100_000);
  });
});

describe("preparePhoto", () => {
  it("縮小済みのバイト列から、ハッシュ・MIME・データURLを作る。同じ内容なら同じハッシュ", async () => {
    const encode = async () => ({ bytes: new TextEncoder().encode("abc"), mime: "image/webp" });
    const a = await preparePhoto(new Blob(["x"]), encode);
    const b = await preparePhoto(new Blob(["y"]), encode);
    expect(a).toEqual({ hash: "ba7816bf8f01cfea", mime: "image/webp", dataUrl: "data:image/webp;base64,YWJj" });
    expect(b.hash).toBe(a.hash);
  });
});
