import { describe, it, expect, vi } from "vitest";
import { createBgmBlobLoader } from "./bgm-blob-loader";

describe("createBgmBlobLoader", () => {
  it("名前が無ければ読み込まない", async () => {
    const blobOf = vi.fn();
    expect(await createBgmBlobLoader({ blobOf })(null)).toBeNull();
    expect(blobOf).not.toHaveBeenCalled();
  });

  it("素材の名前で中身を引いて返す", async () => {
    const blob = new Blob(["a"], { type: "audio/mpeg" });
    const blobOf = vi.fn().mockResolvedValue(blob);
    expect(await createBgmBlobLoader({ blobOf })("bgm.mp3")).toBe(blob);
    expect(blobOf).toHaveBeenCalledWith("bgm.mp3");
  });

  it("素材が無い・読み込みが例外でも null(演出は止めない)", async () => {
    expect(await createBgmBlobLoader({ blobOf: async () => null })("x.mp3")).toBeNull();
    expect(await createBgmBlobLoader({ blobOf: vi.fn().mockRejectedValue(new Error("x")) })("x.mp3")).toBeNull();
  });
});
