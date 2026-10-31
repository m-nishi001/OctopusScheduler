import { describe, expect, it } from "vitest";
import { parseScreenSpec } from "./screen-spec";

describe("parseScreenSpec", () => {
  it("画像・動画は id が要る。余分な項目は捨てる", () => {
    expect(parseScreenSpec({ kind: "image", id: "a1", extra: 1 })).toEqual({ kind: "image", id: "a1" });
    expect(parseScreenSpec({ kind: "video", id: "v1" })).toEqual({ kind: "video", id: "v1" });
    expect(parseScreenSpec({ kind: "image", id: "" })).toBeNull();
    expect(parseScreenSpec({ kind: "video", id: 3 })).toBeNull();
  });

  it("スライドショーは、フォルダ・間隔・切替が正しいときだけ通る", () => {
    expect(parseScreenSpec({ kind: "slideshow", folder: " pics ", intervalSec: 5, transition: "fade" })).toEqual({
      kind: "slideshow",
      folder: "pics",
      intervalSec: 5,
      transition: "fade",
    });
    const base = { kind: "slideshow", folder: "pics", intervalSec: 5, transition: "slide" };
    expect(parseScreenSpec(base)).not.toBeNull();
    expect(parseScreenSpec({ ...base, folder: "" })).toBeNull();
    expect(parseScreenSpec({ ...base, folder: "a/b" })).toBeNull();
    expect(parseScreenSpec({ ...base, intervalSec: 0 })).toBeNull();
    expect(parseScreenSpec({ ...base, intervalSec: 99999 })).toBeNull();
    expect(parseScreenSpec({ ...base, intervalSec: Number.NaN })).toBeNull();
    expect(parseScreenSpec({ ...base, intervalSec: "5" })).toBeNull();
    expect(parseScreenSpec({ ...base, transition: "wipe" })).toBeNull();
  });

  it("html や未知の種類、オブジェクトでないものは通らない", () => {
    expect(parseScreenSpec({ kind: "html", id: "x" })).toBeNull();
    expect(parseScreenSpec(null)).toBeNull();
    expect(parseScreenSpec("image")).toBeNull();
    expect(parseScreenSpec([])).toBeNull();
  });
});
