import { describe, expect, it } from "vitest";
import { MAX_COMMAND_PAYLOAD_BYTES } from "@octopus/session-hub";
import { parseMediaCommand } from "./media-command";

const SHOW = { kind: "slideshow", folder: "pics", intervalSec: 5, transition: "fade" } as const;

describe("parseMediaCommand: play", () => {
  it("assetId が正しければ通す。余分な項目は捨てる", () => {
    expect(parseMediaCommand("play", { assetId: "abc-123_X", extra: 1 })).toEqual({ type: "play", assetId: "abc-123_X" });
  });

  it.each([[undefined], [null], [{}], [{ assetId: "" }], [{ assetId: "a b" }], [{ assetId: "a/b" }], [{ assetId: "あ" }], [{ assetId: 3 }], [{ assetId: "a".repeat(65) }], ["a"], [[]]])(
    "assetId が正しくない(%j)と通さない",
    (payload) => {
      expect(parseMediaCommand("play", payload)).toBeNull();
    }
  );

  it("assetId は 64 文字まで", () => {
    expect(parseMediaCommand("play", { assetId: "a".repeat(64) })).not.toBeNull();
  });
});

describe("parseMediaCommand: stop", () => {
  it("assetId と fadeSec は省略できる(省略はすべて停止)", () => {
    expect(parseMediaCommand("stop", undefined)).toEqual({ type: "stop" });
    expect(parseMediaCommand("stop", {})).toEqual({ type: "stop" });
    expect(parseMediaCommand("stop", { assetId: "a1", fadeSec: 2.5 })).toEqual({ type: "stop", assetId: "a1", fadeSec: 2.5 });
  });

  it.each([0, 10, 0.1])("fadeSec %s は通る(0〜10)", (fadeSec) => {
    expect(parseMediaCommand("stop", { fadeSec })).toEqual({ type: "stop", fadeSec });
  });

  it.each([-0.1, 10.1, Number.NaN, Infinity, "1", null])("fadeSec %j は通さない", (fadeSec) => {
    expect(parseMediaCommand("stop", { fadeSec })).toBeNull();
  });

  it("assetId が指定されていて正しくなければ通さない", () => {
    expect(parseMediaCommand("stop", { assetId: "../x" })).toBeNull();
    expect(parseMediaCommand("stop", { assetId: null })).toBeNull();
  });
});

describe("parseMediaCommand: show", () => {
  it("画像・動画は assetId の形の id が要る", () => {
    expect(parseMediaCommand("show", { spec: { kind: "image", id: "a1" } })).toEqual({ type: "show", spec: { kind: "image", id: "a1" } });
    expect(parseMediaCommand("show", { spec: { kind: "video", id: "v-1" } })).not.toBeNull();
    expect(parseMediaCommand("show", { spec: { kind: "image", id: "a b" } })).toBeNull();
    expect(parseMediaCommand("show", { spec: { kind: "image", id: "" } })).toBeNull();
  });

  it("スライドショーは、フォルダ・間隔(1〜60)・切替が正しいときだけ通る", () => {
    expect(parseMediaCommand("show", { spec: SHOW })).toEqual({ type: "show", spec: SHOW });
    expect(parseMediaCommand("show", { spec: { ...SHOW, intervalSec: 1 } })).not.toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, intervalSec: 60 } })).not.toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, intervalSec: 0.5 } })).toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, intervalSec: 61 } })).toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, transition: "wipe" } })).toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, folder: "a/b" } })).toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, folder: "" } })).toBeNull();
  });

  it("フォルダ名は 100 文字まで", () => {
    expect(parseMediaCommand("show", { spec: { ...SHOW, folder: "f".repeat(100) } })).not.toBeNull();
    expect(parseMediaCommand("show", { spec: { ...SHOW, folder: "f".repeat(101) } })).toBeNull();
  });

  it("html や未知の種類、spec が無いものは通さない", () => {
    expect(parseMediaCommand("show", { spec: { kind: "html", id: "a" } })).toBeNull();
    expect(parseMediaCommand("show", {})).toBeNull();
    expect(parseMediaCommand("show", undefined)).toBeNull();
  });
});

describe("parseMediaCommand: clear と、その他", () => {
  it("clear はペイロードが空でも {} でも通る", () => {
    expect(parseMediaCommand("clear", undefined)).toEqual({ type: "clear" });
    expect(parseMediaCommand("clear", {})).toEqual({ type: "clear" });
  });

  it("4種類以外は通さない", () => {
    expect(parseMediaCommand("pause", {})).toBeNull();
    expect(parseMediaCommand("", {})).toBeNull();
  });

  it(`ペイロードが ${MAX_COMMAND_PAYLOAD_BYTES} バイトを超えたら通さない`, () => {
    expect(parseMediaCommand("play", { assetId: "a", pad: "x".repeat(MAX_COMMAND_PAYLOAD_BYTES) })).toBeNull();
  });
});
