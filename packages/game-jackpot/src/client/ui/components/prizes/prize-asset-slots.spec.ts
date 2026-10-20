import { describe, expect, it } from "vitest";
import { BGM_SLOTS, IMAGE_SLOTS, PRIZE_ASSET_SLOTS, initialSlotMode, slotModeFor } from "./prize-asset-slots";

describe("prize-asset-slots", () => {
  it("画像4つ・BGM2つで、項目名は重ならない", () => {
    expect(IMAGE_SLOTS).toHaveLength(4);
    expect(BGM_SLOTS).toHaveLength(2);
    expect(new Set(PRIZE_ASSET_SLOTS.map((s) => s.field)).size).toBe(6);
  });

  it("画像だけがプレビューの置き場所を持ち、それも重ならない", () => {
    expect(IMAGE_SLOTS.every((s) => !!s.previewKey)).toBe(true);
    expect(BGM_SLOTS.every((s) => s.previewKey === undefined)).toBe(true);
    expect(new Set(IMAGE_SLOTS.map((s) => s.previewKey)).size).toBe(4);
  });

  it("新規の初期の選び方: 画像は新規アップロード、BGM は既存から", () => {
    expect(IMAGE_SLOTS.map(initialSlotMode)).toEqual(["upload", "upload", "upload", "upload"]);
    expect(BGM_SLOTS.map(initialSlotMode)).toEqual(["select", "select"]);
  });

  it("編集では、素材が入っている欄は既存から選ぶ形、空なら新規アップロード", () => {
    const prize = { imageAssetId: "a", bgm1AssetId: "b" };
    const byField = Object.fromEntries(PRIZE_ASSET_SLOTS.map((s) => [s.field, slotModeFor(prize, s)]));
    expect(byField).toEqual({
      imageAssetId: "select",
      image2AssetId: "upload",
      winningImage1AssetId: "upload",
      winningImage2AssetId: "upload",
      bgm1AssetId: "select",
      bgm2AssetId: "upload",
    });
  });
});
