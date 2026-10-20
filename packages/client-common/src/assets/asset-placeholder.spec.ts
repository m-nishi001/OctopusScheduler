import { describe, expect, it } from "vitest";
import {
  assetPlaceholder,
  listAssetPlaceholderIds,
  renderAssetPlaceholders,
  replaceAssetPlaceholderIds,
} from "./asset-placeholder";

describe("asset-placeholder", () => {
  it("目印を作る", () => {
    expect(assetPlaceholder("image", "a1")).toBe("{{asset:image:a1}}");
    expect(assetPlaceholder("video", "TMP_x")).toBe("{{asset:video:TMP_x}}");
  });

  it("目印の id を、出てくる順に重複なしで取り出す。目印でないものは無視する", () => {
    const html = "<p>{{asset:image:a}}</p>{{asset:video:b}}{{asset:image:a}} {{asset:audio:c}} {asset:image:d}";
    expect(listAssetPlaceholderIds(html)).toEqual(["a", "b"]);
    expect(listAssetPlaceholderIds("")).toEqual([]);
  });

  it("何度呼んでも同じ結果になる(正規表現の状態が残らない)", () => {
    const html = "{{asset:image:a}}";
    expect(listAssetPlaceholderIds(html)).toEqual(["a"]);
    expect(listAssetPlaceholderIds(html)).toEqual(["a"]);
    expect(renderAssetPlaceholders(html, () => "u")).toBe(renderAssetPlaceholders(html, () => "u"));
  });

  describe("renderAssetPlaceholders", () => {
    const urls: Record<string, string> = { a: "blob:a", b: "blob:b" };
    const urlOf = (id: string) => urls[id];

    it("画像は <img>、動画は <video controls> にする", () => {
      expect(renderAssetPlaceholders("x{{asset:image:a}}y{{asset:video:b}}z", urlOf)).toBe(
        'x<img src="blob:a" alt="asset" />y<video src="blob:b" controls></video>z'
      );
    });

    it("autoplay を指定すると動画だけに付く", () => {
      expect(renderAssetPlaceholders("{{asset:image:a}}{{asset:video:b}}", urlOf, { autoplay: true })).toBe(
        '<img src="blob:a" alt="asset" /><video src="blob:b" controls autoplay></video>'
      );
    });

    it("URL が無い id の目印はそのまま残す", () => {
      expect(renderAssetPlaceholders("{{asset:image:zzz}}", urlOf)).toBe("{{asset:image:zzz}}");
    });
  });

  describe("replaceAssetPlaceholderIds", () => {
    it("対応表にある id だけを付け替え、種類(image/video)は保つ", () => {
      const map = new Map([["TMP_1", "real-1"], ["TMP_2", "real-2"]]);
      expect(replaceAssetPlaceholderIds("{{asset:image:TMP_1}} {{asset:video:TMP_2}} {{asset:image:keep}}", map)).toBe(
        "{{asset:image:real-1}} {{asset:video:real-2}} {{asset:image:keep}}"
      );
    });

    it("同じ id が複数回出ても全部付け替える", () => {
      expect(replaceAssetPlaceholderIds("{{asset:image:t}}{{asset:image:t}}", new Map([["t", "r"]]))).toBe("{{asset:image:r}}{{asset:image:r}}");
    });
  });
});
