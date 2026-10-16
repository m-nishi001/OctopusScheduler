import { describe, it, expect, vi, afterEach } from "vitest";
import { createBgmBlobLoader } from "./bgm-blob-loader";

const loaderFor = (asset: unknown) =>
  createBgmBlobLoader({ getAssetDataById: vi.fn().mockResolvedValue(asset) });

describe("createBgmBlobLoader", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("アセットIDが無ければ読み込まない", async () => {
    const getAssetDataById = vi.fn();
    expect(await createBgmBlobLoader({ getAssetDataById })(null)).toBeNull();
    expect(getAssetDataById).not.toHaveBeenCalled();
  });

  it("Blob はそのまま返す", async () => {
    const blob = new Blob(["a"], { type: "audio/mpeg" });
    expect(await loaderFor({ blob })("id")).toBe(blob);
  });

  it("URL文字列は取得して Blob にする。取得に失敗したら null", async () => {
    const blob = new Blob(["b"]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }));
    expect(await loaderFor({ blob: "blob:http://x/1" })("id")).toBe(blob);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    expect(await loaderFor({ blob: "blob:http://x/2" })("id")).toBeNull();
  });

  it("Blob に似たオブジェクトは Blob に組み立てる", async () => {
    const out = await loaderFor({ blob: { type: "audio/wav", size: 3 } })("id");
    expect(out).toBeInstanceOf(Blob);
    expect(out?.type).toBe("audio/wav");
  });

  it("アセットが無い・中身が無い・読み込みが例外でも null(演出は止めない)", async () => {
    expect(await loaderFor(null)("id")).toBeNull();
    expect(await loaderFor({})("id")).toBeNull();
    const failing = createBgmBlobLoader({ getAssetDataById: vi.fn().mockRejectedValue(new Error("x")) });
    expect(await failing("id")).toBeNull();
  });
});
